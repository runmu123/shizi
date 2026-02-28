/**
 * 平台检测工具
 * 用于检测应用是否运行在 Android 原生环境
 */

class PlatformDetector {
    /**
     * 检测是否为原生平台（Android）
     * @returns {boolean} 是否为原生平台
     */
    static isNativePlatform() {
        return typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform;
    }

    /**
     * 检测是否为 Web 平台
     * @returns {boolean} 是否为 Web 平台
     */
    static isWebPlatform() {
        return !this.isNativePlatform();
    }

    /**
     * 检测是否为 Android 平台
     * @returns {boolean} 是否为 Android 平台
     */
    static isAndroid() {
        if (!this.isNativePlatform()) {
            return false;
        }
        return window.Capacitor.getPlatform() === 'android';
    }

    /**
     * 获取当前平台名称
     * @returns {string} 平台名称：'android' | 'web'
     */
    static getPlatform() {
        if (this.isAndroid()) {
            return 'android';
        }
        return 'web';
    }
}

// 导出平台检测工具
export default PlatformDetector;
