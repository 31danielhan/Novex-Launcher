package dev.novex.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.OpenGlHelper;
import net.minecraft.entity.Entity;
import net.minecraft.entity.item.EntityItem;
import net.minecraft.entity.item.EntityXPOrb;

/**
 * Built-in performance work, always on. It only skips drawing that can't really be seen and never
 * changes what's sent to a server. The mixins for entities, particles and frame rate call into here.
 */
public final class Optimizer {
	/** Dropped items and XP orbs are specks past this. */
	private static final double LOOSE_ENTITY_RANGE = 48;
	private static final double PARTICLE_RANGE = 32;
	/** Frame rate while the window isn't focused. */
	public static final int BACKGROUND_FPS = 30;

	private Optimizer() {}

	/** VBOs draw chunks far faster, and 1.8.9 leaves them off by default. */
	static void enableVbos(Minecraft mc) {
		if (mc.gameSettings.useVbo || !OpenGlHelper.vboSupported) return;
		mc.gameSettings.useVbo = true;
		if (mc.theWorld != null) mc.renderGlobal.loadRenderers();
	}

	public static boolean skipEntity(Entity e, double camX, double camY, double camZ) {
		if (!(e instanceof EntityItem) && !(e instanceof EntityXPOrb)) return false;
		return e.getDistanceSq(camX, camY, camZ) > LOOSE_ENTITY_RANGE * LOOSE_ENTITY_RANGE;
	}

	public static boolean skipParticle(Entity particle) {
		Entity view = Minecraft.getMinecraft().getRenderViewEntity();
		return view != null && view.getDistanceSqToEntity(particle) > PARTICLE_RANGE * PARTICLE_RANGE;
	}
}
