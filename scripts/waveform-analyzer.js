/**
 * Waveform Analyzer
 * Extracts audio data and generates a visual waveform representation
 */

export class WaveformAnalyzer {
  constructor() {
    console.log('🔧 [WaveformAnalyzer] Constructor called - NEW CODE VERSION');
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.waveformData = [];
    this.sourceConnected = false;
  }

  /**
   * Initialize AudioContext on first user gesture
   */
  ensureAudioContextReady() {
    console.log('[Analyzer] ensureAudioContextReady called, audioContext exists?', !!this.audioContext);
    
    if (this.audioContext) {
      console.log('[Analyzer] AudioContext already exists, returning true');
      return true;
    }

    try {
      const ContextClass = window.AudioContext || window.webkitAudioContext;
      console.log('[Analyzer] Creating new AudioContext, class available?', !!ContextClass);
      
      this.audioContext = new ContextClass();
      console.log('[Analyzer] AudioContext created:', { state: this.audioContext.state, sampleRate: this.audioContext.sampleRate });
      
      this.analyser = this.audioContext.createAnalyser();
      console.log('[Analyzer] Analyser created:', { fftSize: this.analyser.fftSize, frequencyBinCount: this.analyser.frequencyBinCount });
      
      this.analyser.fftSize = 2048;
      console.log('[Analyzer] FFT size set to 2048, new frequencyBinCount:', this.analyser.frequencyBinCount);
      
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      console.log('[Analyzer] DataArray created:', { length: this.dataArray.length });
      
      console.log('[Analyzer] ✅ AudioContext initialized successfully');
      return true;
    } catch (err) {
      console.error('[Analyzer] ❌ Failed to initialize AudioContext:', err);
      console.error('[Analyzer] Error details:', { name: err.name, message: err.message, stack: err.stack });
      return false;
    }
  }

  /**
   * Resume AudioContext if suspended (browser policy)
   */
  resumeAudioContext() {
    if (!this.audioContext) return;
    
    try {
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
    } catch (err) {
      console.warn('Could not resume AudioContext:', err);
    }
  }

  /**
   * Connect an audio element to the analyzer
   */
  connectAudioElement(audioElement) {
    console.log('[Analyzer] connectAudioElement called', { 
      audioElement: !!audioElement,
      audioSrc: audioElement?.src,
      sourceConnected: this.sourceConnected,
      analyserExists: !!this.analyser,
      dataArrayExists: !!this.dataArray
    });
    
    if (!this.ensureAudioContextReady()) {
      console.error('[Analyzer] ❌ ensureAudioContextReady failed, cannot proceed');
      return false;
    }

    console.log('[Analyzer] After ensureAudioContextReady:', { 
      audioContext: !!this.audioContext,
      analyser: !!this.analyser,
      dataArray: !!this.dataArray
    });

    if (this.sourceConnected) {
      console.log('[Analyzer] Already connected, skipping');
      return true;
    }

    try {
      console.log('[Analyzer] Starting connection process...');
      
      this.resumeAudioContext();
      console.log('[Analyzer] AudioContext state:', this.audioContext.state);

      console.log('[Analyzer] Creating media element audio source for element:', audioElement.tagName);
      const source = this.audioContext.createMediaElementAudioSource(audioElement);
      console.log('[Analyzer] ✅ Created media element audio source');
      
      console.log('[Analyzer] Connecting source to analyser...');
      source.connect(this.analyser);
      console.log('[Analyzer] ✅ Connected source to analyser');
      
      console.log('[Analyzer] Connecting analyser to destination...');
      this.analyser.connect(this.audioContext.destination);
      console.log('[Analyzer] ✅ Connected analyser to destination');
      
      this.sourceConnected = true;
      console.log('[Analyzer] ✅✅✅ SUCCESSFULLY CONNECTED! FFT size:', this.analyser.fftSize, 'Frequency bins:', this.analyser.frequencyBinCount);
      return true;
    } catch (err) {
      console.error('[Analyzer] ❌ Failed to connect audio analyzer:');
      console.error('[Analyzer] Error type:', err.name);
      console.error('[Analyzer] Error message:', err.message);
      console.error('[Analyzer] Full error:', err);
      return false;
    }
  }

  /**
   * Get current frequency data for visualization
   */
  getFrequencyData() {
    if (!this.analyser || !this.dataArray) {
      console.warn('[Analyzer] getFrequencyData: analyser or dataArray is null', { analyser: !!this.analyser, dataArray: !!this.dataArray });
      return [];
    }
    try {
      this.analyser.getByteFrequencyData(this.dataArray);
      const data = Array.from(this.dataArray);
      
      // Log if we're getting data
      if (!this.lastLogTime) this.lastLogTime = Date.now();
      if (Date.now() - this.lastLogTime > 3000) {
        const nonZero = data.filter(v => v > 0).length;
        console.log(`[Analyzer] getFrequencyData: Got ${data.length} frequency bins, ${nonZero} non-zero values`);
        this.lastLogTime = Date.now();
      }
      
      return data;
    } catch (err) {
      console.error('[Analyzer] Error getting frequency data:', err);
      return [];
    }
  }

  /**
   * Get waveform data by averaging frequency bands
   * @param {number} bars - Number of bars to represent the waveform
   * @returns {Array<number>} - Array of normalized values 0-1
   */
  getWaveformBars(bars = 100) {
    const frequencyData = this.getFrequencyData();
    
    // If we have actual frequency data, use it directly
    if (frequencyData.length > 0) {
      const barsData = [];
      const barsPerSection = Math.floor(frequencyData.length / bars);

      for (let i = 0; i < bars; i++) {
        let sum = 0;
        for (let j = 0; j < barsPerSection; j++) {
          const idx = i * barsPerSection + j;
          if (idx < frequencyData.length) {
            sum += frequencyData[idx];
          }
        }
        const average = sum / barsPerSection / 255; // Normalize to 0-1
        barsData.push(Math.max(0.01, average));
      }
      
      // Debug: log min/max values every 30 frames
      if (!this.debugFrame) this.debugFrame = 0;
      this.debugFrame++;
      if (this.debugFrame % 30 === 0) {
        const min = Math.min(...barsData);
        const max = Math.max(...barsData);
        console.log(`[Waveform] Frequency Data - Min: ${min.toFixed(3)}, Max: ${max.toFixed(3)}, Range: ${(max - min).toFixed(3)}`);
      }
      
      return barsData;
    }

    // No frequency data available - return zeros for real waveform representation
    return new Array(bars).fill(0.01);
  }

  /**
   * Get smoothed waveform data
   * @param {number} bars - Number of bars
   * @param {number} smoothing - Smoothing factor (0-1, lower = more responsive)
   * @returns {Array<number>}
   */
  getSmoothedWaveform(bars = 100, smoothing = 0.3) {
    const newData = this.getWaveformBars(bars);

    if (this.waveformData.length === 0 || this.waveformData.length !== newData.length) {
      this.waveformData = newData;
    } else {
      // Minimal smoothing for responsiveness
      this.waveformData = this.waveformData.map((val, i) => {
        return val * smoothing + newData[i] * (1 - smoothing);
      });
    }

    return this.waveformData;
  }

  /**
   * Extract waveform from audio buffer (for pre-loading waveform data)
   */
  async getWaveformFromBuffer(audioBuffer, bars = 100) {
    const rawData = audioBuffer.getChannelData(0); // Get left channel
    const blockSize = Math.floor(rawData.length / bars);
    const waveform = [];

    for (let i = 0; i < bars; i++) {
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(rawData[i * blockSize + j]);
      }
      const average = sum / blockSize;
      waveform.push(Math.max(0.05, average)); // Normalize and add minimum
    }

    return waveform;
  }

  /**
   * Fetch and decode audio from URL to get static waveform data
   */
  async extractWaveformFromUrl(url, bars = 100) {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      return this.getWaveformFromBuffer(audioBuffer, bars);
    } catch (err) {
      console.error('Error extracting waveform:', err);
      return this.generatePlaceholderWaveform(bars);
    }
  }

  /**
   * Generate a placeholder waveform for testing
   */
  generatePlaceholderWaveform(bars = 100) {
    const waveform = [];
    for (let i = 0; i < bars; i++) {
      const normalized = i / bars;
      const value = Math.sin(normalized * Math.PI * 2) * 0.3 + 0.5;
      waveform.push(Math.max(0.05, value));
    }
    return waveform;
  }
}

/**
 * Waveform Renderer
 * Draws waveform visualization on canvas
 */
export class WaveformRenderer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.waveformData = [];
    this.fillProgress = 0;
    this.backgroundColor = '#2a2a2a';
    this.waveColor = '#00ff88';
    this.fillColor = '#00ff88';
    this.unfillColor = '#444444';
  }

  /**
   * Set colors for the waveform
   */
  setColors(waveColor, fillColor, unfillColor = '#444444', backgroundColor = '#2a2a2a') {
    this.waveColor = waveColor;
    this.fillColor = fillColor;
    this.unfillColor = unfillColor;
    this.backgroundColor = backgroundColor;
  }

  /**
   * Update waveform data
   */
  setWaveformData(data) {
    this.waveformData = data;
  }

  /**
   * Set progress (0-1)
   */
  setProgress(progress) {
    this.fillProgress = Math.max(0, Math.min(1, progress));
  }

  /**
   * Draw the waveform on canvas
   */
  draw() {
    const { canvas, ctx, waveformData, fillProgress } = this;
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;

    // Clear canvas
    ctx.fillStyle = this.backgroundColor;
    ctx.fillRect(0, 0, width, height);

    if (waveformData.length === 0) return;

    const barWidth = width / waveformData.length;
    const fillBars = Math.floor(waveformData.length * fillProgress);
    const padding = Math.max(1, barWidth * 0.15);
    const maxBarHeight = height * 0.85;

    // Find min/max for normalization
    const min = Math.min(...waveformData);
    const max = Math.max(...waveformData);
    const range = max - min > 0 ? max - min : 1;

    // Draw bars
    for (let i = 0; i < waveformData.length; i++) {
      // Normalize to 0-1 range, then scale to full height
      const normalized = (waveformData[i] - min) / range;
      const barHeight = Math.max(1, normalized * maxBarHeight);
      const x = i * barWidth + padding;
      const y = centerY - barHeight / 2;
      const drawWidth = barWidth - padding * 2;

      // Use different color based on progress
      if (i < fillBars) {
        ctx.fillStyle = this.fillColor;
      } else {
        ctx.fillStyle = this.unfillColor;
      }

      // Draw rectangle with border radius fallback
      const radius = 3;
      if (ctx.roundRect) {
        // Modern browsers
        ctx.beginPath();
        ctx.roundRect(x, y, drawWidth, barHeight, radius);
        ctx.fill();
      } else {
        // Fallback for older browsers
        this.drawRoundRect(ctx, x, y, drawWidth, barHeight, radius);
      }
    }

    // Debug every 30 frames
    if (!this.debugFrame) this.debugFrame = 0;
    this.debugFrame++;
    if (this.debugFrame % 30 === 0) {
      console.log(`[Renderer] Data range: ${min.toFixed(3)} - ${max.toFixed(3)}, Bars: ${waveformData.length}, Progress: ${fillProgress.toFixed(2)}`);
    }
  }

  /**
   * Fallback rounded rectangle drawing for older browsers
   */
  drawRoundRect(ctx, x, y, width, height, radius) {
    if (width < 2 * radius) radius = width / 2;
    if (height < 2 * radius) radius = height / 2;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Responsive resize handling
   */
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (this.canvas.width !== rect.width || this.canvas.height !== rect.height) {
      this.canvas.width = rect.width;
      this.canvas.height = rect.height;
      this.draw();
    }
  }

  /**
   * Clear the canvas
   */
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
