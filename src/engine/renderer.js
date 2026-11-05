/**
 * Canvas renderer. Draws in world units under a uniform scale, so the court keeps its
 * proportions and letterboxes instead of stretching. The backing store follows
 * devicePixelRatio, which keeps edges sharp on high-density laptop screens.
 */

const TRAIL_LENGTH = 28;
const CYAN = '#00f5ff';
const MAGENTA = '#ff2d95';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const trail = [];
  let cssW = 0;
  let cssH = 0;
  let dpr = 1;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(globalThis.devicePixelRatio || 1, 2.5);
    cssW = rect.width;
    cssH = rect.height;
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
  }

  function fit(world) {
    const scale = Math.min(cssW / world.width, cssH / world.height);
    return {
      scale,
      ox: (cssW - world.width * scale) / 2,
      oy: (cssH - world.height * scale) / 2,
    };
  }

  function drawBackground() {
    const g = ctx.createRadialGradient(cssW / 2, cssH * 0.4, 0, cssW / 2, cssH / 2, Math.max(cssW, cssH) * 0.8);
    g.addColorStop(0, '#1d1046');
    g.addColorStop(0.6, '#0b0620');
    g.addColorStop(1, '#030209');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cssW, cssH);
  }

  function drawCourt(world) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0, 245, 255, 0.45)';
    ctx.strokeRect(1, 1, world.width - 2, world.height - 2);
    ctx.setLineDash([12, 14]);
    ctx.beginPath();
    ctx.moveTo(world.width / 2, 0);
    ctx.lineTo(world.width / 2, world.height);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawTrail(world) {
    for (let i = 0; i < trail.length; i += 1) {
      const p = trail[i];
      const k = (i + 1) / trail.length;
      ctx.globalAlpha = k * 0.5;
      ctx.fillStyle = CYAN;
      ctx.beginPath();
      ctx.arc(p.x, p.y, world.ballR * k * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPaddle(world, paddle, color) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = color;
    ctx.fillRect(paddle.x, paddle.y, world.paddleW, world.paddleH);
    ctx.shadowBlur = 0;
  }

  function drawBall(world, ball) {
    ctx.shadowColor = CYAN;
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#e8ffff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, world.ballR, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function draw(match) {
    if (!cssW || !cssH) return;
    const { world } = match;
    const { scale, ox, oy } = fit(world);

    if (match.ball.vx !== 0) {
      trail.push({ x: match.ball.x, y: match.ball.y });
      if (trail.length > TRAIL_LENGTH) trail.shift();
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    drawBackground();

    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    drawCourt(world);
    drawTrail(world);
    drawPaddle(world, match.paddles.player, CYAN);
    drawPaddle(world, match.paddles.ai, MAGENTA);
    drawBall(world, match.ball);
  }

  return {
    resize,
    draw,
    resetTrail() {
      trail.length = 0;
    },
  };
}
