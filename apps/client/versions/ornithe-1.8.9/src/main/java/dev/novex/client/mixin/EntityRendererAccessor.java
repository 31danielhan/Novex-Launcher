package dev.novex.client.mixin;

import net.minecraft.client.renderer.EntityRenderer;
import net.minecraft.util.ResourceLocation;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Invoker;

/** Forge made loadShader public; vanilla keeps it private. */
@Mixin(EntityRenderer.class)
public interface EntityRendererAccessor {
	@Invoker("loadShader")
	void novex$loadShader(ResourceLocation shader);
}
