package dev.novex.client.mixin;

import dev.novex.client.core.NovexCore;
import net.minecraft.client.Minecraft;
import net.minecraft.client.entity.AbstractClientPlayer;
import net.minecraft.client.renderer.GlStateManager;
import net.minecraft.client.renderer.ItemRenderer;
import net.minecraft.util.MathHelper;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.ModifyArg;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * 1.7 animations. While eating, drinking or blocking, 1.8 holds the item still by passing 0 as the
 * swing progress; 1.7 passed the real swing, so the item swings while in use. Visual only.
 */
@Mixin(ItemRenderer.class)
public abstract class ItemRendererMixin {
	private static float novex$partialTicks;

	@Inject(method = "renderItemInFirstPerson", at = @At("HEAD"))
	private void novex$capture(float partialTicks, CallbackInfo ci) {
		novex$partialTicks = partialTicks;
	}

	// Calls in renderItemInFirstPerson: 0 = no action, 1 = eat/drink, 2 = block, 3 = bow, 4 = not in use.
	@ModifyArg(method = "renderItemInFirstPerson",
			at = @At(value = "INVOKE", target = "Lnet/minecraft/client/renderer/ItemRenderer;transformFirstPersonItem(FF)V", ordinal = 1),
			index = 1)
	private float novex$eatSwing(float swing) {
		return NovexCore.config.oldEating ? swing() : swing;
	}

	@ModifyArg(method = "renderItemInFirstPerson",
			at = @At(value = "INVOKE", target = "Lnet/minecraft/client/renderer/ItemRenderer;transformFirstPersonItem(FF)V", ordinal = 2),
			index = 1)
	private float novex$blockSwing(float swing) {
		return NovexCore.config.oldBlockHit ? swing() : swing;
	}

	/**
	 * Smooth eating: the same 4-tick bob and lift to the mouth as vanilla, but the bob is a rounded wave
	 * instead of a sharp bounce, and it fades in instead of starting all at once.
	 */
	@Inject(method = "performDrinking", at = @At("HEAD"), cancellable = true)
	private void novex$smoothEating(AbstractClientPlayer player, float partialTicks, CallbackInfo ci) {
		// 1.7 eating is the original animation, with the swing: none of Novex's own on top.
		if (!NovexCore.config.smoothEating || NovexCore.config.oldEating) return;
		ci.cancel();
		float count = player.getItemInUseCount() - partialTicks + 1;
		float left = count / player.getHeldItem().getMaxItemUseDuration();
		float in = Math.max(0, Math.min(1, (0.9f - left) / 0.2f));
		in = in * in * (3 - 2 * in);
		// Ripping, for the first 35% (the normal bob takes the rest): every 3 ticks the food's top
		// tips out to one side, its bottom staying put, while it comes in toward your face, then glides back.
		// Each swing is one smooth wave, and the ripping fades in and out instead of starting and stopping.
		float rip = 0;
		if (NovexCore.config.eatingStyle == 1) {
			float beat = 3f, beats = (float) Math.floor(count / beat), t = 1 - (count / beat - beats);
			float r = Math.max(0, Math.min(1, Math.min((1 - left) / 0.08f, (left - 0.65f) / 0.1f)));
			rip = r * r * (3 - 2 * r);
			float pull = rip * MathHelper.sin(t * (float) Math.PI);
			float side = pull * (beats % 2 == 0 ? -1 : 0.7f);
			// Both turns pivot on the bottom of the food where it sits while eating (worked out from
			// the lift to the mouth and the held-item offset below), so the bottom stays put: the top
			// leans in toward you and swings left and right.
			float bx = -0.17f, by = -0.71f, bz = -0.85f;
			GlStateManager.translate(bx, by, bz);
			GlStateManager.rotate(pull * 14, 1, 0, 0);
			GlStateManager.rotate(side * 28, 0, 0, 1);
			GlStateManager.translate(-bx, -by, -bz);
		}
		GlStateManager.translate(0, 0.05f * in * (1 - rip) * (1 - MathHelper.cos(count * (float) Math.PI / 2)), 0);
		float lift = 1 - (float) Math.pow(left, 27);
		GlStateManager.translate(lift * 0.6f, lift * -0.5f, 0);
		GlStateManager.rotate(lift * 90, 0, 1, 0);
		GlStateManager.rotate(lift * 10, 1, 0, 0);
		GlStateManager.rotate(lift * 30, 0, 0, 1);
	}

	private static float swing() {
		return Minecraft.getMinecraft().thePlayer.getSwingProgress(novex$partialTicks);
	}
}
