package dev.novex.client.mixin;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.ScaledResolution;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Mutable;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * GUI scale on a full-resolution Retina screen (Argentum Extras' High-DPI Screen). The game draws
 * at twice the pixels there, so a GUI scale counted in pixels would make the menus half their size.
 * The scale is worked out from the window's size in points instead, then multiplied by the pixels
 * per point: GUI scale 2 looks the size it always did, just twice as sharp.
 */
@Mixin(ScaledResolution.class)
public abstract class ScaledResolutionMixin {
	@Shadow @Final @Mutable private double scaledWidthD;
	@Shadow @Final @Mutable private double scaledHeightD;
	@Shadow private int scaledWidth;
	@Shadow private int scaledHeight;
	@Shadow private int scaleFactor;

	@Inject(method = "<init>", at = @At("RETURN"))
	private void novex$pixelScale(Minecraft mc, CallbackInfo ci) {
		int pixels = dev.novex.client.PixelScale.get();
		if (pixels <= 1) return;
		int width = mc.displayWidth / pixels, height = mc.displayHeight / pixels;
		int max = mc.gameSettings.guiScale == 0 ? 1000 : mc.gameSettings.guiScale;
		int scale = 1;
		while (scale < max && width / (scale + 1) >= 320 && height / (scale + 1) >= 240) scale++;
		if (mc.isUnicode() && scale % 2 != 0 && scale != 1) scale--;
		scaleFactor = scale * pixels;
		scaledWidthD = (double) mc.displayWidth / scaleFactor;
		scaledHeightD = (double) mc.displayHeight / scaleFactor;
		scaledWidth = (int) Math.ceil(scaledWidthD);
		scaledHeight = (int) Math.ceil(scaledHeightD);
	}
}
