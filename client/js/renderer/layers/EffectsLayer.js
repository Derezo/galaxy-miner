/**
 * EffectsLayer - Renders visual effects
 * Weapons, particles, death effects, chain lightning, tesla coils
 */
const EffectsLayer = {
  /**
   * Draw all effects
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} camera - Camera position
   */
  draw(ctx, camera) {
    // Draw weapon effects (projectiles, impacts)
    WeaponRenderer.draw(ctx, camera);

    // Draw NPC weapon effects
    if (typeof NPCWeaponEffects !== 'undefined') {
      NPCWeaponEffects.draw(ctx, camera);
    }

    // Draw particle system
    ParticleSystem.draw(ctx, camera);

    // Draw death effects (explosions)
    if (typeof DeathEffects !== 'undefined') {
      DeathEffects.draw(ctx, camera);
    }

    // Draw player death effect (special sequence)
    if (typeof PlayerDeathEffect !== 'undefined' && PlayerDeathEffect.isActive()) {
      PlayerDeathEffect.draw(ctx, camera);
    }

    // Draw base destruction sequences
    if (typeof BaseDestructionSequence !== 'undefined') {
      BaseDestructionSequence.draw(ctx, camera);
    }

    // Draw void effects (rifts, gravity wells)
    if (typeof VoidEffects !== 'undefined') {
      VoidEffects.draw(ctx, camera);
    }

    // Draw linked damage effect (formation damage sharing)
    if (typeof LinkedDamageEffect !== 'undefined') {
      LinkedDamageEffect.draw(ctx, camera);
    }

    // Draw formation succession effect
    if (typeof FormationSuccessionEffect !== 'undefined') {
      FormationSuccessionEffect.draw(ctx, camera);
    }

    // Draw chain lightning (Tesla Cannon tier 5)
    if (typeof ChainLightningEffect !== 'undefined') {
      ChainLightningEffect.draw(ctx, camera);
    }

    // Draw tesla coil effect (Tesla Cannon on base hit)
    if (typeof TeslaCoilEffect !== 'undefined') {
      TeslaCoilEffect.draw(ctx, camera);
    }

    // Draw floating text (damage numbers)
    if (typeof FloatingTextSystem !== 'undefined') {
      FloatingTextSystem.draw(ctx, camera);
    }

    // Draw star effects (corona flares, heat overlay)
    if (typeof StarEffects !== 'undefined') {
      StarEffects.draw(ctx, camera, RenderContext.width, RenderContext.height);
    }

    // Draw reward display (credits/loot popup)
    if (typeof RewardDisplay !== 'undefined') {
      RewardDisplay.draw(ctx);
    }

    // Draw graveyard atmosphere effects
    if (typeof GraveyardAtmosphere !== 'undefined' && GraveyardAtmosphere.isActive()) {
      GraveyardAtmosphere.drawEffects(ctx, RenderContext.camera, RenderContext.width, RenderContext.height);
    }
  }
};
