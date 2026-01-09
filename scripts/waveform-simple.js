/**
 * Static Waveform Renderer
 * Displays waveform data from the backend as a static visualization
 */

export class SimpleWaveformRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.waveformBars = [];
    this.barCount = 120;
    this.barGap = 4;
  }

  /**
   * Draw the waveform on canvas
   */
  draw() {
    if (!this.canvas || !this.ctx) {
      return;
    }

    if (this.waveformBars.length === 0) {
      return;
    }

    const width = this.canvas.width;
    const height = this.canvas.height;
    const barWidth = (width / this.barCount) - this.barGap;
    const centerY = height / 2;
    const maxBarHeight = height;

    // Clear canvas
    this.ctx.clearRect(0, 0, width, height);

    // Create gradient
    const gradient = this.ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#00ccff');
    gradient.addColorStop(1, '#a855f7');

    // Draw center horizontal line
    this.ctx.strokeStyle = gradient;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, centerY);
    this.ctx.lineTo(width, centerY);
    this.ctx.stroke();

    // Draw bars
    for (let i = 0; i < this.barCount; i++) {
      let barHeight = this.waveformBars[i] * maxBarHeight;
      const x = i * (barWidth + this.barGap);
      
      // Draw filled bar
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
    }
  }
}
