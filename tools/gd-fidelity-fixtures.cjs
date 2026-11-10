// Functions are serialized into the real browser by Playwright.
function slopeMotion() {
  const s = window.scene.get('GameScene'), l = s._level, player = s._player;
  const saved = { state: { ...player.p }, nearby: l.getNearbySectionObjects, floor: l.getFloorY,
    ceiling: l.getCeilingY, x: s._playerWorldX, noclip: window.noClip };
  const fields = ['_slopeRiding', '_slopeExitVel', '_prevSlopeObj', '_prevSlopeAngle', '_slopeExitGrace',
    '_activeSlopeObj', '_activeSlopeAngle', '_slopeContactFrames', '_rotation', 'rotateActionActive',
    '_lastSlopeSeatY', '_slopeContactTime', '_slopeStepSeconds',
    '_lastCollisionWorldX', '_lastCollisionWorldY'];
  const old = Object.fromEntries(fields.map(key => [key, player[key]]));
  const result = [];
  try {
    l.getFloorY = () => -10000; l.getCeilingY = () => null; window.noClip = false;
    for (const id of [289, 291, 1743]) for(const rotation of [0,90,180,270]) for (const flipX of [0, 1]) for (const flipY of [0, 1]) for (const mini of [false, true]) {
      const create = (x, y) => _createSlopeCollider(parseObject(`1,${id},2,100,3,250,4,${flipX},5,${flipY},6,${rotation}`), allObjects[id], x, y);
      const first = create(200, 500), width = first.w, angle = first.getSlopeAngleRad(), slope = Math.tan(angle);
      const colliders = [first, ...[1, 2, 3].map(i => create(200 + i * width, 500 + i * width * slope))];
      l.getNearbySectionObjects = () => colliders;
      Object.assign(player.p, new PlayerState());
      Object.assign(player, { _slopeRiding: true, _slopeExitVel: 0, _prevSlopeObj: first, _prevSlopeAngle: angle,
        _slopeExitGrace: 0, _slopeContactFrames: 20, rotateActionActive: false, _rotation: .123 });
      const size = mini ? Math.fround(30*Math.fround(.6)) : 30, sign = first.slopeSolidBelow ? 1 : -1;
      const radius = size / Math.cos(Math.atan(slope));
      Object.assign(player.p, { isMini: mini, gravityFlipped: !first.slopeSolidBelow,
        y: 500 + sign * radius, onGround: true, canJump: false });
      player._lastCollisionWorldX = 200; player._lastCollisionWorldY = player.p.y;
      const step = playerSpeed * d * .25;
      let maxError = 0, drops = 0, ticks = 0;
      for (let x = 200; x < 200 + width * 2.5; x += step) {
        player.beginFrameContacts();
        s._playerWorldX = x; player.p.lastY = player.p.y;
        player.updateJump(.225); player.p.y += player.p.yVelocity * .225;
        player.checkCollisions(x - centerX); ticks++;
        const expected = 500 + (x - 200) * slope + sign * radius;
        maxError = Math.max(maxError, Math.abs(player.p.y - expected));
        if (!player._slopeRiding) drops++;
        if (player.p.isDead) break;
      }
      result.push({ id, rotation, flipX, flipY, mini, ticks, maxError, drops, dead: player.p.isDead });
    }
  } finally {
    l.getNearbySectionObjects = saved.nearby; l.getFloorY = saved.floor; l.getCeilingY = saved.ceiling;
    Object.assign(player.p, saved.state); Object.assign(player, old);
    s._playerWorldX = saved.x; window.noClip = saved.noclip;
  }
  return result;
}

module.exports = { slopeMotion };
