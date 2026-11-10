package dev.novex.client;

import dev.novex.client.core.OfflineSkin;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import javax.imageio.ImageIO;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.util.ResourceLocation;

/** The offline account's skin as a game texture, loaded the first time it's drawn. */
public final class SkinTexture {
	private static boolean loaded;
	private static ResourceLocation id;

	private SkinTexture() {}

	/** The texture, or null if this account has no skin from the launcher. */
	public static ResourceLocation get() {
		if (!loaded) {
			loaded = true;
			byte[] png = OfflineSkin.image();
			if (png != null) {
				try {
					BufferedImage image = ImageIO.read(new ByteArrayInputStream(png));
					ResourceLocation texture = new ResourceLocation("novex-client", "offline_skin");
					Minecraft.getMinecraft().getTextureManager().loadTexture(texture, new DynamicTexture(image));
					id = texture;
				} catch (IOException e) {
					System.err.println("[Novex] Couldn't load the offline skin: " + e);
				}
			}
		}
		return id;
	}

	/** Whether a player is the one using this game, since only they wear the skin. */
	public static boolean isLocal(String name) {
		return name.equals(Minecraft.getMinecraft().getSession().getUsername());
	}
}
