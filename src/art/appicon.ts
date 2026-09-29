// The app icon (DESIGN.md §20): a brass U-turn arrow over a winding dirt road on grass. The
// game's premise, "send them the long way round". Drawn at any size. `any` is a rounded tile;
// `maskable` fills the square and keeps the picture inside the central 80% circle Android may crop to;
// `apple` fills the square (iOS rounds the corners itself).
import { P } from './palette.ts';

export type IconVariant = 'any' | 'maskable' | 'apple';

export function drawAppIcon(ctx: CanvasRenderingContext2D, size: number, variant: IconVariant): void {
  const s = size / 512;
  ctx.save();
  ctx.scale(s, s);
  // Grass, full bleed for maskable and Apple icons; a rounded tile for the plain one.
  const r = variant === 'any' ? 96 : 0;
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, P.grassLight);
  grad.addColorStop(1, P.grassMid);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(0, 0, 512, 512, r);
  ctx.fill();
  ctx.clip();
  // Inside the maskable safe circle everything is drawn a little smaller.
  const k = variant === 'maskable' ? 0.78 : 1;
  ctx.translate(256, 256);
  ctx.scale(k, k);
  ctx.translate(-256, -256);
  // The winding road the army is sent down.
  const road = (): void => {
    ctx.beginPath();
    ctx.moveTo(40, 430);
    ctx.bezierCurveTo(200, 430, 90, 250, 250, 250);
    ctx.bezierCurveTo(410, 250, 310, 80, 472, 80);
  };
  ctx.lineCap = 'round';
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = 112;
  road();
  ctx.stroke();
  ctx.strokeStyle = P.dirt;
  ctx.lineWidth = 92;
  road();
  ctx.stroke();
  ctx.setLineDash([22, 26]);
  ctx.strokeStyle = P.dirtDark;
  ctx.lineWidth = 8;
  road();
  ctx.stroke();
  ctx.setLineDash([]);
  // The detour: a fat brass U-turn arrow with an ink outline and a highlight.
  const arrow = (tail = 0): void => {
    ctx.beginPath();
    ctx.moveTo(150, 360 + tail);
    ctx.lineTo(150, 230);
    ctx.arc(256, 230, 106, Math.PI, 0);
    ctx.lineTo(362, 300);
  };
  const head = (): void => {
    ctx.beginPath();
    ctx.moveTo(300, 290);
    ctx.lineTo(424, 290);
    ctx.lineTo(362, 390);
    ctx.closePath();
  };
  ctx.lineJoin = 'round';
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = 88;
  ctx.lineCap = 'butt';
  // The outline runs a little past the brass at the tail, so the cut end has its ink line too.
  arrow(12);
  ctx.stroke();
  ctx.lineWidth = 24;
  head();
  ctx.stroke();
  ctx.fillStyle = P.ink;
  head();
  ctx.fill();
  ctx.strokeStyle = P.brass;
  ctx.lineWidth = 64;
  arrow();
  ctx.stroke();
  ctx.fillStyle = P.brass;
  ctx.beginPath();
  ctx.moveTo(312, 298);
  ctx.lineTo(412, 298);
  ctx.lineTo(362, 378);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = P.brassLight;
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(256, 230, 118, Math.PI * 1.08, Math.PI * 1.6);
  ctx.stroke();
  ctx.restore();
}
