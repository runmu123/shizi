// 音频管理器：录音、上传、播放音频（使用 Supabase）
class AudioManager {
  constructor() {
    this.supabase = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.currentAudio = null;
  }

  init() {
    if (this.supabase) return;
    
    if (typeof supabase === 'undefined') {
      console.error('Supabase 库未加载');
      return;
    }
    if (typeof SUPABASE_CONFIG === 'undefined') {
      console.error('SUPABASE_CONFIG 未找到');
      return;
    }
    this.supabase = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
  }

  // 获取单元编号（如 "第一单元" -> "1", "第一百二十三单元" -> "123"）
  getUnitCode(unit) {
    // 如果已经是数字或包含数字
    const numMatch = unit.match(/\d+/);
    if (numMatch) return numMatch[0];

    const match = unit.match(/第(.+)单元/);
    if (!match) return unit;
    
    const s = match[1];
    const map = { '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
    const units = { '十': 10, '百': 100, '千': 1000 };
    
    let result = 0;
    let temp = 0;
    let hasNum = false;

    for (let i = 0; i < s.length; i++) {
      const char = s[i];
      if (map[char] !== undefined) {
        temp = map[char];
        hasNum = true;
      } else if (units[char]) {
        if (char === '十' && temp === 0 && result === 0) temp = 1;
        result += temp * units[char];
        temp = 0;
        hasNum = true;
      }
    }
    result += temp;
    
    // 如果无法解析且不含数字字符，返回原始字符串
    if (!hasNum) return s;

    return result;
  }

  // 获取拼音（如 "口" -> "kou"）
  getPinyin(char) {
    if (typeof pinyinPro !== 'undefined') {
       return pinyinPro.pinyin(char, { 
         toneType: 'none', 
         separator: '',
         nonZh: 'consecutive' 
       }).replace(/\s+/g, '').replace(/ü/g, 'v');
    }
    return char;
  }

  // 生成文件路径：L1/Unit_1/kou/filename.mp3
  getFilePath(level, unit, char, text, type, index) {
    const unitCode = this.getUnitCode(unit);
    const charPy = this.getPinyin(char);
    
    const safeLevel = encodeURIComponent(level);
    const safeUnit = encodeURIComponent(`Unit_${unitCode}`);
    const safeChar = encodeURIComponent(charPy);
    
    let filename = '';
    if (type === 'char') {
      filename = 'char.mp3';
    } else if (type === 'sentence') {
      filename = 'sentence.mp3';
    } else if (type === 'word') {
       if (index !== undefined && index !== null) {
         filename = `word_${index + 1}.mp3`;
       } else {
         const hash = md5(text.trim());
         filename = `word_${hash}.mp3`; 
       }
    } else {
       const hash = md5(text.trim());
       filename = `${hash}.mp3`;
    }
    
    return `${safeLevel}/${safeUnit}/${safeChar}/${filename}`;
  }

  async startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('不支持媒体设备');
    }

    try {
      console.log('正在请求麦克风权限...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          console.log('录音块大小:', event.data.size);
        }
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      console.log('录音已开始');
    } catch (err) {
      console.error('启动录音失败:', err);
      throw err;
    }
  }

  stopRecording() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        try {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/mp3' });
          this.isRecording = false;
          this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
          console.log('录音已停止，blob 大小:', audioBlob.size);
          resolve(audioBlob);
        } catch (error) {
          reject(error);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        reject(event.error);
      };

      this.mediaRecorder.stop();
    });
  }

  async uploadAudio(blob, level, unit, char, text, type, index) {
    this.init();
    
    if (!type) {
        console.warn('上传缺少类型，正在推断');
        if (text === char) type = 'char';
        else if (text.length > 1 && !text.includes(' ')) type = 'word';
        else type = 'sentence';
    }

    const filePath = this.getFilePath(level, unit, char, text, type, index);
    console.log(`上传音频到: ${filePath}, Blob 大小: ${blob.size}, 类型: ${type}`);

    try {
      const { data, error } = await this.supabase
        .storage
        .from(SUPABASE_CONFIG.bucket)
        .upload(filePath, blob, {
          contentType: 'audio/mp3',
          upsert: true,
          metadata: {
            originalText: text,
            type: type
          }
        });

      if (error) {
        console.error('Supabase 上传错误:', error);
        throw error;
      }
      
      console.log('上传成功:', data);

      // 写入 audio_records 表
      const { error: dbError } = await this.supabase
        .from('audio_records')
        .upsert({
          path: filePath,
          level: level,
          unit: unit,
          char: char,
          type: type,
          created_at: new Date()
        }, { onConflict: 'path' });

      if (dbError) {
        console.error('数据库写入错误 (audio_records):', dbError);
      }

      return data;
    } catch (err) {
      console.error('上传失败:', err);
      throw err;
    }
  }

  async getAllAudioRecords() {
    this.init();
    const { data, error } = await this.supabase
      .from('audio_records')
      .select('*');
    if (error) {
      console.error('获取音频记录失败:', error);
      return [];
    }
    return data;
  }

  async getAudioStats() {
    this.init();
    const { count, error } = await this.supabase
      .from('audio_records')
      .select('*', { count: 'exact', head: false })
      .eq('type', 'char')
      .limit(1);
    
    if (error) {
        console.error('统计音频数量失败:', error);
    }

    const { data: latest, error: latestError } = await this.supabase
      .from('audio_records')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return { 
      charCount: count || 0, 
      latest: latest 
    };
  }

  getAudioUrl(level, unit, char, text, type, index) {
    this.init();
    const filePath = this.getFilePath(level, unit, char, text, type, index);
    const { data } = this.supabase
      .storage
      .from(SUPABASE_CONFIG.bucket)
      .getPublicUrl(filePath);
    return data.publicUrl;
  }

  // 停止当前音频播放并触发回调
  stopCurrentAudio() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    if (this.onStopCallback) {
      this.onStopCallback();
      this.onStopCallback = null;
    }
  }

  async playAudio(level, unit, char, text, type, index, onStopCallback) {
    this.init();
    const filePath = this.getFilePath(level, unit, char, text, type, index);
    const { data } = this.supabase
      .storage
      .from(SUPABASE_CONFIG.bucket)
      .getPublicUrl(filePath);
    
    const baseUrl = data.publicUrl;
    // 添加时间戳绕过 CDN 缓存
    const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
    let playUrl = url;
    
    // 停止当前播放并触发回调
    this.stopCurrentAudio();

    // 从缓存读取或从服务器获取
    if ('caches' in window) {
       try {
          const cache = await caches.open('shizi-audio-cache');
          const cached = await cache.match(baseUrl);
          if (cached) {
             const blob = await cached.blob();
             playUrl = URL.createObjectURL(blob);
             console.log('从缓存播放:', baseUrl);
          } else {
             try {
                // 使用 no-store 避免重复存储到 HTTP Cache
                const fetched = await fetch(url, { cache: 'no-store' });
                if (fetched.ok) {
                   await cache.put(baseUrl, fetched.clone());
                   const blob = await fetched.blob();
                   playUrl = URL.createObjectURL(blob);
                }
             } catch (fetchErr) {
                console.warn('播放时缓存音频失败:', fetchErr);
             }
          }
       } catch (e) {
          console.warn('缓存操作失败:', e);
       }
    }

    // 播放
    try {
        // 释放之前的 blob URL 避免内存泄漏
        if (this.currentAudioUrl && this.currentAudioUrl.startsWith('blob:')) {
           URL.revokeObjectURL(this.currentAudioUrl);
        }
        this.currentAudioUrl = playUrl;

        this.currentAudio = new Audio(playUrl);
        this.onStopCallback = onStopCallback;

        this.currentAudio.onended = () => {
          if (this.onStopCallback) {
            this.onStopCallback();
            this.onStopCallback = null;
          }
          this.currentAudio = null;
        };

        this.currentAudio.onerror = (e) => {
          console.warn('音频播放错误', e);
          if (this.onStopCallback) {
            this.onStopCallback();
            this.onStopCallback = null;
          }
          this.currentAudio = null;
        };
        
        await this.currentAudio.play();
        return true;
    } catch (e) {
        console.warn('音频播放失败（可能不存在）:', e);
        if (this.onStopCallback) {
             this.onStopCallback();
             this.onStopCallback = null;
        }
        return false;
    }
  }
}

const audioManager = new AudioManager();
