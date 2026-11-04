package dev.novex.client.mixin;

import dev.novex.client.core.NovexCore;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.ItemRenderer;
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

	private static float swing() {
		return Minecraft.getMinecraft().thePlayer.getSwingProgress(novex$partialTicks);
	}
}
