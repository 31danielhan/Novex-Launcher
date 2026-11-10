package dev.novex.client.mixin;

import dev.novex.client.core.NovexCore;
import net.minecraft.client.renderer.EntityRenderer;
import net.minecraft.client.settings.GameSettings;
import net.minecraft.entity.Entity;
import net.minecraft.entity.player.EntityPlayer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.Redirect;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Damage tilt, smooth sneak, fullbright, camera stabilize on servers and the per-frame hook. */
@Mixin(EntityRenderer.class)
public abstract class EntityRendererMixin {
	/** Once per frame, before the world draws. */
	@Inject(method = "updateCameraAndRender", at = @At("HEAD"))
	private void novex$frame(float partialTicks, long nanoTime, CallbackInfo ci) {
		dev.novex.client.NovexClient.frame();
	}

	// orientCamera's last two first-person rotations (calls 8 and 10) are the view pitch and yaw.
	@org.spongepowered.asm.mixin.injection.ModifyArg(method = "orientCamera",
			at = @At(value = "INVOKE", target = "Lnet/minecraft/client/renderer/GlStateManager;rotate(FFFF)V", ordinal = 8), index = 0)
	private float novex$viewPitch(float pitch) {
		return dev.novex.client.NovexClient.viewPitch(pitch);
	}

	@org.spongepowered.asm.mixin.injection.ModifyArg(method = "orientCamera",
			at = @At(value = "INVOKE", target = "Lnet/minecraft/client/renderer/GlStateManager;rotate(FFFF)V", ordinal = 10), index = 0)
	private float novex$viewYaw(float yaw) {
		return dev.novex.client.NovexClient.viewYaw(yaw);
	}

	/**
	 * Puts texturing back after a post-processing shader. 1.8.9's shader passes switch texturing on
	 * for every texture unit they sample from but only unbind them afterwards, and the motion blur
	 * samples from units 1 and 2. Unit 1 is the lightmap, so the HUD, held items and the next frame's
	 * world drew with an empty lightmap and came out dark, and nothing in vanilla turns unit 2 back
	 * off, so it stayed dark after the blur was turned off. Both are off at this point in vanilla.
	 */
	@Inject(method = "updateCameraAndRender", at = @At(value = "INVOKE",
			target = "Lnet/minecraft/client/shader/ShaderGroup;loadShaderGroup(F)V", shift = At.Shift.AFTER))
	private void novex$afterShaders(CallbackInfo ci) {
		for (int unit = 1; unit <= 2; unit++) {
			net.minecraft.client.renderer.GlStateManager.setActiveTexture(net.minecraft.client.renderer.OpenGlHelper.defaultTexUnit + unit);
			net.minecraft.client.renderer.GlStateManager.disableTexture2D();
		}
		net.minecraft.client.renderer.GlStateManager.setActiveTexture(net.minecraft.client.renderer.OpenGlHelper.defaultTexUnit);
	}

	@Inject(method = "hurtCameraEffect", at = @At("HEAD"), cancellable = true)
	private void novex$damageTilt(float partialTicks, CallbackInfo ci) {
		if (!NovexCore.config.damageTilt) ci.cancel();
	}

	private static float novex$eyeHeight;
	private static long novex$eyeTime;

	/** Smooth sneak: eases the height the camera sits at. Aiming and reach still use the real one. */
	@Redirect(method = "orientCamera", at = @At(value = "INVOKE", target = "Lnet/minecraft/entity/Entity;getEyeHeight()F"))
	private float novex$smoothSneak(Entity entity) {
		float real = entity.getEyeHeight();
		// Sneak drops the camera 0.233, two thirds of the 0.35 in newer versions, instead of 1.8's 0.08.
		if (NovexCore.config.smoothSneak && entity instanceof EntityPlayer && entity.isSneaking()) real -= 0.153f;
		long now = System.nanoTime();
		double seconds = (now - novex$eyeTime) / 1e9;
		novex$eyeTime = now;
		// Anything bigger than sneaking is sleeping or spectating another entity, so it jumps straight there.
		if (!NovexCore.config.smoothSneak || Math.abs(real - novex$eyeHeight) > 0.4f || seconds > 0.25) return novex$eyeHeight = real;
		novex$eyeHeight += (real - novex$eyeHeight) * (float) (1 - Math.exp(-seconds / 0.05));
		return novex$eyeHeight;
	}

	/** Fullbright: raises the gamma the lightmap reads, without touching the saved brightness option. */
	@Redirect(method = "updateLightmap", at = @At(value = "FIELD", target = "Lnet/minecraft/client/settings/GameSettings;gammaSetting:F"))
	private float novex$fullbright(GameSettings settings) {
		return NovexCore.config.fullbright ? 16f : settings.gammaSetting;
	}
}
