/**
 * Export Manager for D&D 5e Battlemaps
 * High-res PNG rendering, VTT JSON export, and seed URL generator
 */

import { BattlemapRenderer } from './renderer.js';
import { BattlemapGrid } from './grid.js';

export class ExportManager {
  static exportImage(map, gridManager, fogManager, tokenManager, options = {}) {
    const scale = options.scale || 2; // 2x default for high clarity
    const includeGrid = options.includeGrid !== false;
    const includeFog = !!options.includeFog;
    const includeTokens = options.includeTokens !== false;
    const format = options.format || 'image/png';

    const W = map.grid.totalWidth;
    const H = map.grid.totalHeight;

    const offCanvas = document.createElement('canvas');
    offCanvas.width = W * scale;
    offCanvas.height = H * scale;

    const renderer = new BattlemapRenderer(offCanvas);
    renderer.render(map, { x: 0, y: 0, scale: scale }, options);

    const ctx = offCanvas.getContext('2d');

    // Grid overlay
    if (includeGrid && gridManager) {
      gridManager.render(ctx, map, { x: 0, y: 0, scale: scale });
    }

    // Tokens overlay
    if (includeTokens && tokenManager) {
      tokenManager.render(ctx, map, { x: 0, y: 0, scale: scale });
    }

    // Fog overlay
    if (includeFog && fogManager && fogManager.enabled) {
      fogManager.render(ctx, { x: 0, y: 0, scale: scale });
    }

    // Download trigger
    const dataUrl = offCanvas.toDataURL(format, 0.95);
    const link = document.createElement('a');
    const safeSeed = map.seed.replace(/[^a-zA-Z0-9_-]/g, '_');
    link.download = `battlemap_${map.biomeId}_${safeSeed}_${map.grid.cols}x${map.grid.rows}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Free resources
    offCanvas.width = 1;
    offCanvas.height = 1;
  }

  static exportVTTJson(map) {
    const vttData = {
      format: 0.2,
      resolution: {
        map_origin: { x: 0, y: 0 },
        map_size: { x: map.grid.cols, y: map.grid.rows },
        pixels_per_grid: map.grid.cellSize
      },
      grid: {
        grid_type: 'square',
        grid_size: map.grid.cellSize,
        grid_feet: 5
      },
      environment: {
        biome: map.biomeId,
        seed: map.seed,
        title: map.encounterInfo.title,
        lighting: map.lighting
      },
      lights: [],
      line_of_sight: [],
      portals: []
    };

    // Add campfire light if present
    if (map.camp) {
      vttData.lights.push({
        position: { x: map.camp.campfire.x, y: map.camp.campfire.y },
        range: map.camp.campfire.lightRadius,
        color: '#ff9900',
        intensity: 0.8
      });
    }

    // Add building walls
    for (const b of map.buildings) {
      vttData.line_of_sight.push(
        [ { x: b.x, y: b.y }, { x: b.x + b.width, y: b.y } ],
        [ { x: b.x + b.width, y: b.y }, { x: b.x + b.width, y: b.y + b.height } ],
        [ { x: b.x + b.width, y: b.y + b.height }, { x: b.x, y: b.y + b.height } ],
        [ { x: b.x, y: b.y + b.height }, { x: b.x, y: b.y } ]
      );
    }

    const jsonString = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(vttData, null, 2));
    const link = document.createElement('a');
    link.download = `battlemap_${map.biomeId}_${map.seed}.json`;
    link.href = jsonString;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  static getShareUrl(map) {
    const url = new URL(window.location.href);
    url.searchParams.set('seed', map.seed);
    url.searchParams.set('biome', map.biomeId);
    url.searchParams.set('w', map.grid.cols);
    url.searchParams.set('h', map.grid.rows);
    return url.toString();
  }
}
