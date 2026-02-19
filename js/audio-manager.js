// Audio Manager for recording, uploading, and playing audio using Supabase
class AudioManager {
  constructor() {
    this.supabase = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.currentAudio = null; // For playing
    this.recordingCallback = null; // To update UI during recording
  }

  init() {
    if (this.supabase) return;
    
    if (typeof supabase === 'undefined') {
      console.error('Supabase library not loaded');
      return;
    }
    if (typeof SUPABASE_CONFIG === 'undefined') {
      console.error('SUPABASE_CONFIG not found');
      return;
    }
    this.supabase = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
  }

  // Helper to get unit number (e.g. "第一单元" -> "1")
  getUnitCode(unit) {
    const numMap = {
      '一': '1', '二': '2', '三': '3', '四': '4', '五': '5',
      '六': '6', '七': '7', '八': '8', '九': '9', '十': '10',
      '十一': '11', '十二': '12'
    };
    // Match "第X单元"
    const match = unit.match(/第([一二三四五六七八九十]+)单元/);
    if (match) {
       const numStr = match[1];
       return numMap[numStr] || numStr;
    }
    return unit; 
  }

  // Helper to get pinyin (e.g. "口" -> "kou")
  getPinyin(char) {
    if (typeof pinyinPro !== 'undefined') {
       // toneType: 'none' removes tones
       // nonZh: 'consecutive' keeps non-Chinese chars together
       return pinyinPro.pinyin(char, { 
         toneType: 'none', 
         separator: '',
         nonZh: 'consecutive' 
       }).replace(/\s+/g, '');
    }
    return char;
  }

  // Generate path: L1/Unit_1/kou/md5.mp3
  getFilePath(level, unit, char, text, type) {
    const content = text.trim();
    const hash = md5(content);
    
    const unitCode = this.getUnitCode(unit);
    const charPy = this.getPinyin(char);
    
    // We can assume unitCode and charPy are ASCII safe now, but keep encodeURIComponent for safety if they fallback
    const safeLevel = encodeURIComponent(level);
    const safeUnit = encodeURIComponent(`Unit_${unitCode}`);
    const safeChar = encodeURIComponent(charPy);
    
    return `${safeLevel}/${safeUnit}/${safeChar}/${hash}.mp3`;
  }

  async startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Media devices not supported');
    }

    try {
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          console.log('Recorded chunk size:', event.data.size);
        }
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      console.log('Recording started');
    } catch (err) {
      console.error('Error starting recording:', err);
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
          console.log('Recording stopped, blob size:', audioBlob.size);
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

  async uploadAudio(blob, level, unit, char, text, type) {
    this.init();
    
    const filePath = this.getFilePath(level, unit, char, text, type);
    console.log(`Uploading audio to: ${filePath}, Blob size: ${blob.size}`);

    try {
      const { data, error } = await this.supabase
        .storage
        .from(SUPABASE_CONFIG.bucket)
        .upload(filePath, blob, {
          contentType: 'audio/mp3',
          upsert: true,
          metadata: {
            originalText: encodeURIComponent(text),
            type: type
          }
        });

      if (error) {
        console.error('Supabase upload error:', error);
        throw error;
      }
      
      console.log('Upload successful:', data);
      return data;
    } catch (err) {
      console.error('Upload failed:', err);
      throw err;
    }
  }

  getAudioUrl(level, unit, char, text) {
    this.init();
    const filePath = this.getFilePath(level, unit, char, text);
    const { data } = this.supabase
      .storage
      .from(SUPABASE_CONFIG.bucket)
      .getPublicUrl(filePath);
    return data.publicUrl;
  }
  
  async playAudio(level, unit, char, text) {
    const url = this.getAudioUrl(level, unit, char, text);
    
    // Stop current audio
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }

    // Try to play
    try {
        // Optional: Check if file exists by fetching head
        // const res = await fetch(url, { method: 'HEAD' });
        // if (!res.ok) throw new Error('Audio not found');

        this.currentAudio = new Audio(url);
        // Return a promise that resolves when playback starts or fails
        await this.currentAudio.play();
        return true;
    } catch (e) {
        console.warn('Audio play failed (likely not exists):', e);
        return false;
    }
  }
}

const audioManager = new AudioManager();
