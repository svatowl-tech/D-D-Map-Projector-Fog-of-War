/**
 * Fog of War Manager for D&D 5e Battlemaps
 * High-performance 2D canvas mask with zero memory leaks
 */

export class FogOfWar {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.enabled = false;
    this.dmMode = true; // DM sees semi-transparent fog, Player sees solid black
    this.dmOpacity = 0.55;

    // Create offscreen fog mask
    this.fogCanvas = document.createElement('canvas');
    this.fogCanvas.width = width;
    this.fogCanvas.height = height;
    this.fogCtx = this.fogCanvas.getContext('2d');

    this.reset(true); // Start fully covered
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    const oldCanvas = this.fogCanvas;
    this.fogCanvas = document.createElement('canvas');
    this.fogCanvas.width = width;
    this.fogCanvas.height = height;
    this.fogCtx = this.fogCanvas.getContext('2d');

    // Copy existing fog or fill
    this.fogCtx.fillStyle = '#000000';
    this.fogCtx.fillRect(0, 0, width, height);
    if (oldCanvas) {
      this.fogCtx.drawImage(oldCanvas, 0, 0);
    }
  }

  reset(fullyCovered = true) {
    this.fogCtx.globalCompositeOperation = 'source-over';
    this.fogCtx.fillStyle = '#000000';
    if (fullyCovered) {
      this.fogCtx.fillRect(0, 0, this.width, this.height);
    } else {
      this.fogCtx.clearRect(0, 0, this.width, this.height);
    }
  }

  revealBrush(x, y, radius = 40) {
    this.fogCtx.save();
    this.fogCtx.globalCompositeOperation = 'destination-out';
    const grad = this.fogCtx.createRadialGradient(x, y, radius * 0.75, x, y, radius);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    this.fogCtx.fillStyle = grad;
    this.fogCtx.beginPath();
    this.fogCtx.arc(x, y, radius, 0, Math.PI * 2);
    this.fogCtx.fill();
    this.fogCtx.restore();
  }

  hideBrush(x, y, radius = 40) {
    this.fogCtx.save();
    this.fogCtx.globalCompositeOperation = 'source-over';
    this.fogCtx.fillStyle = '#000000';
    this.fogCtx.beginPath();
    this.fogCtx.arc(x, y, radius, 0, Math.PI * 2);
    this.fogCtx.fill();
    this.fogCtx.restore();
  }

  revealRect(x, y, w, h) {
    this.fogCtx.save();
    this.fogCtx.globalCompositeOperation = 'destination-out';
    this.fogCtx.fillStyle = '#000000';
    this.fogCtx.fillRect(x, y, w, h);
    this.fogCtx.restore();
  }

  render(ctx, viewTransform = { x: 0, y: 0, scale: 1 }) {
    if (!this.enabled) return;

    ctx.save();
    ctx.translate(viewTransform.x, viewTransform.y);
    ctx.scale(viewTransform.scale, viewTransform.scale);

    ctx.globalAlpha = this.dmMode ? this.dmOpacity : 1.0;
    ctx.drawImage(this.fogCanvas, 0, 0);

    ctx.restore();
  }

  // Export fog state as Base64 image for sync
  exportState() {
    return {
      enabled: this.enabled,
      dataUrl: this.fogCanvas.toDataURL('image/png')
    };
  }

  // Import state from BroadcastChannel
  importState(state) {
    if (!state) return;
    this.enabled = !!state.enabled;
    if (state.dataUrl) {
      const img = new Image();
      img.onload = () => {
        this.fogCtx.globalCompositeOperation = 'source-over';
        this.fogCtx.clearRect(0, 0, this.width, this.height);
        this.fogCtx.drawImage(img, 0, 0);
      };
      img.src = state.dataUrl;
    }
  }
}
