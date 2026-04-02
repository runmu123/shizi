#!/usr/bin/env python
# -*- coding: utf-8 -*-

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import requests
import yaml


ROOT_DIR = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT_DIR / "js" / "app" / "config.js"
YAML_DIR = ROOT_DIR / "yaml"
TABLE_NAME = "user_mistakes"


@dataclass
class SupabaseConfig:
    url: str
    key: str


def load_supabase_config() -> SupabaseConfig:
    text = CONFIG_PATH.read_text(encoding="utf-8")
    url_match = re.search(r"url:\s*'([^']+)'", text)
    key_match = re.search(r"key:\s*'([^']+)'", text)
    if not url_match or not key_match:
        raise RuntimeError(f"未能从 {CONFIG_PATH} 解析 Supabase 配置")
    return SupabaseConfig(url=url_match.group(1), key=key_match.group(1))


def normalize_wrong_chars(value: Any, fallback_level: str, fallback_unit: str) -> list[dict[str, str]]:
    if value is None:
        return []
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return []
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return []
    if not isinstance(value, list):
        return []

    seen: set[tuple[str, str, str]] = set()
    result: list[dict[str, str]] = []
    for item in value:
        if isinstance(item, str):
            char = item.strip()
            level = fallback_level
            unit = fallback_unit
        elif isinstance(item, dict):
            char = str(item.get("char", "")).strip()
            level = str(item.get("level", fallback_level) or fallback_level).strip()
            unit = str(item.get("unit", fallback_unit) or fallback_unit).strip()
        else:
            continue

        if not char:
            continue
        key = (char, level, unit)
        if key in seen:
            continue
        seen.add(key)
        result.append({"char": char, "level": level, "unit": unit})
    return result


def merge_wrong_chars(
    left: Any,
    right: Any,
    fallback_level: str,
    fallback_unit: str,
) -> list[dict[str, str]]:
    combined = normalize_wrong_chars(left, fallback_level, fallback_unit)
    existing = {(item["char"], item["level"], item["unit"]) for item in combined}
    for item in normalize_wrong_chars(right, fallback_level, fallback_unit):
        key = (item["char"], item["level"], item["unit"])
        if key in existing:
            continue
        existing.add(key)
        combined.append(item)
    return combined


def parse_iso_datetime(value: Any) -> datetime:
    if not value:
        return datetime.min
    text = str(value).strip()
    if not text:
        return datetime.min
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return datetime.min


def load_char_unit_map() -> dict[tuple[str, str], str]:
    mapping: dict[tuple[str, str], str] = {}
    for yaml_path in sorted(YAML_DIR.glob("contents_L*.yaml")):
        level = yaml_path.stem.replace("contents_", "")
        content = yaml.safe_load(yaml_path.read_text(encoding="utf-8")) or {}
        if not isinstance(content, dict):
            continue
        for unit_name, unit_data in content.items():
            if not isinstance(unit_data, dict):
                continue
            for char in unit_data.keys():
                char_text = str(char).strip()
                if not char_text:
                    continue
                mapping[(level, char_text)] = str(unit_name).strip()
    return mapping


class SupabaseRestClient:
    def __init__(self, config: SupabaseConfig) -> None:
        self.base_url = f"{config.url.rstrip('/')}/rest/v1"
        self.session = requests.Session()
        self.session.headers.update(
            {
                "apikey": config.key,
                "Authorization": f"Bearer {config.key}",
                "Content-Type": "application/json",
            }
        )

    def fetch_all_user_mistakes(self) -> list[dict[str, Any]]:
        response = self.session.get(
            f"{self.base_url}/{TABLE_NAME}",
            params={"select": "*", "order": "username.asc,level.asc,unit.asc,char.asc,mistake_mode.asc"},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def find_target_record(self, row: dict[str, Any], correct_unit: str) -> dict[str, Any] | None:
        response = self.session.get(
            f"{self.base_url}/{TABLE_NAME}",
            params={
                "select": "*",
                "username": f"eq.{row['username']}",
                "char": f"eq.{row['char']}",
                "level": f"eq.{row['level']}",
                "unit": f"eq.{correct_unit}",
                "mistake_mode": f"eq.{row['mistake_mode']}",
            },
            headers={"Accept": "application/json"},
            timeout=30,
        )
        response.raise_for_status()
        rows = response.json()
        return rows[0] if rows else None

    def patch_row(self, row_id: str, payload: dict[str, Any]) -> None:
        response = self.session.patch(
            f"{self.base_url}/{TABLE_NAME}",
            params={"id": f"eq.{row_id}"},
            data=json.dumps(payload, ensure_ascii=False),
            headers={"Prefer": "return=minimal"},
            timeout=30,
        )
        response.raise_for_status()

    def delete_row(self, row_id: str) -> None:
        response = self.session.delete(
            f"{self.base_url}/{TABLE_NAME}",
            params={"id": f"eq.{row_id}"},
            headers={"Prefer": "return=minimal"},
            timeout=30,
        )
        response.raise_for_status()


def build_mismatch_report(rows: list[dict[str, Any]], mapping: dict[tuple[str, str], str]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    mismatches: list[dict[str, Any]] = []
    unresolved: list[dict[str, Any]] = []

    for row in rows:
        level = str(row.get("level") or "").strip()
        char = str(row.get("char") or "").strip()
        current_unit = str(row.get("unit") or "").strip()
        correct_unit = mapping.get((level, char))

        if not level or not char:
            unresolved.append(
                {
                    "row": row,
                    "reason": "缺少 level 或 char",
                }
            )
            continue

        if not correct_unit:
            unresolved.append(
                {
                    "row": row,
                    "reason": f"未在 YAML 中找到 {level} / {char} 的单元",
                }
            )
            continue

        if current_unit == correct_unit:
            continue

        mismatches.append(
            {
                "row": row,
                "correct_unit": correct_unit,
                "wrong_chars": normalize_wrong_chars(row.get("wrong_chars"), level, current_unit),
            }
        )

    return mismatches, unresolved


def print_report(mismatches: list[dict[str, Any]], unresolved: list[dict[str, Any]]) -> None:
    print("=" * 80)
    print("user_mistakes 单元一致性比对结果")
    print("=" * 80)
    print(f"不一致记录数: {len(mismatches)}")
    print(f"无法判定记录数: {len(unresolved)}")
    print()

    if mismatches:
        print("以下记录 unit 与根据 char 反查出的正确单元不一致：")
        for index, item in enumerate(mismatches, start=1):
            row = item["row"]
            wrong_chars = item["wrong_chars"]
            wrong_desc = "、".join(
                f"{entry['char']}({entry['level']}/{entry['unit']})" for entry in wrong_chars
            ) or "无"
            print(
                f"{index}. id={row.get('id')} | user={row.get('username')} | "
                f"mode={row.get('mistake_mode')} | level={row.get('level')} | "
                f"char={row.get('char')} | 当前单元={row.get('unit')} | 正确单元={item['correct_unit']}"
            )
            print(f"   误认字: {wrong_desc}")
        print()

    if unresolved:
        print("以下记录暂时无法自动修正：")
        for index, item in enumerate(unresolved, start=1):
            row = item["row"]
            print(
                f"{index}. id={row.get('id')} | user={row.get('username')} | mode={row.get('mistake_mode')} | "
                f"level={row.get('level')} | char={row.get('char')} | unit={row.get('unit')} | 原因={item['reason']}"
            )
        print()


def apply_fixes(client: SupabaseRestClient, mismatches: list[dict[str, Any]]) -> None:
    if not mismatches:
        print("没有需要修复的记录。")
        return

    print("开始执行修复...")
    updated_count = 0
    merged_count = 0
    skipped_count = 0

    for item in mismatches:
        row = item["row"]
        correct_unit = item["correct_unit"]
        row_id = str(row["id"])
        target = client.find_target_record(row, correct_unit)

        try:
            if target and str(target.get("id")) != row_id:
                merged_wrong_chars = merge_wrong_chars(
                    target.get("wrong_chars"),
                    row.get("wrong_chars"),
                    str(row.get("level") or "").strip(),
                    correct_unit,
                )
                payload = {
                    "mistake_count": int(target.get("mistake_count") or 0) + int(row.get("mistake_count") or 0),
                    "wrong_chars": merged_wrong_chars,
                    "last_wrong_at": max(
                        [target.get("last_wrong_at"), row.get("last_wrong_at")],
                        key=parse_iso_datetime,
                    ),
                    "updated_at": datetime.utcnow().isoformat() + "Z",
                }
                client.patch_row(str(target["id"]), payload)
                client.delete_row(row_id)
                merged_count += 1
                print(
                    f"[MERGED] {row.get('username')} | {row.get('char')} | {row.get('mistake_mode')} | "
                    f"{row.get('unit')} -> {correct_unit}"
                )
                continue

            payload = {
                "unit": correct_unit,
                "updated_at": datetime.utcnow().isoformat() + "Z",
            }
            client.patch_row(row_id, payload)
            updated_count += 1
            print(
                f"[UPDATED] {row.get('username')} | {row.get('char')} | {row.get('mistake_mode')} | "
                f"{row.get('unit')} -> {correct_unit}"
            )
        except requests.HTTPError as exc:
            skipped_count += 1
            response_text = exc.response.text if exc.response is not None else str(exc)
            print(
                f"[SKIPPED] id={row_id} | user={row.get('username')} | char={row.get('char')} | "
                f"原因={response_text}"
            )

    print()
    print("修复完成：")
    print(f"- 直接更新: {updated_count}")
    print(f"- 合并后删除旧记录: {merged_count}")
    print(f"- 跳过失败: {skipped_count}")


def main() -> int:
    try:
        config = load_supabase_config()
        mapping = load_char_unit_map()
        client = SupabaseRestClient(config)
        rows = client.fetch_all_user_mistakes()
        mismatches, unresolved = build_mismatch_report(rows, mapping)
        print_report(mismatches, unresolved)

        if not mismatches:
            return 0

        answer = input("是否执行更改？(y or n): ").strip().lower()
        if answer != "y":
            print("已取消，不做任何更改。")
            return 0

        apply_fixes(client, mismatches)
        return 0
    except KeyboardInterrupt:
        print("\n已取消。")
        return 1
    except Exception as exc:
        print(f"执行失败: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
