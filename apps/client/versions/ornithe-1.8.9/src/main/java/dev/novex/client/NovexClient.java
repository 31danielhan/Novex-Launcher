package dev.novex.client;

import dev.novex.client.core.Clicks;
import dev.novex.client.core.Game;
import dev.novex.client.core.Gfx;
import dev.novex.client.core.Hud;
import dev.novex.client.core.Module;
import dev.novex.client.core.NovexCore;
import dev.novex.client.core.Stabilizer;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.client.Minecraft;
import net.minecraft.client.entity.EntityPlayerSP;
import net.minecraft.client.gui.FontRenderer;
import net.minecraft.client.gui.Gui;
import net.minecraft.client.gui.GuiButton;
import net.minecraft.client.gui.GuiChat;
import net.minecraft.client.gui.GuiMainMenu;
import net.minecraft.client.gui.GuiScreen;
import net.minecraft.client.gui.ScaledResolution;
import net.minecraft.client.network.NetworkPlayerInfo;
import net.minecraft.client.renderer.EntityRenderer;
import net.minecraft.client.renderer.GlStateManager;
import net.minecraft.client.renderer.RenderHelper;
import net.minecraft.client.resources.I18n;
import net.minecraft.client.settings.KeyBinding;
import net.minecraft.item.ItemStack;
import net.minecraft.potion.PotionEffect;
import net.minecraft.util.ResourceLocation;
import org.lwjgl.input.Keyboard;
import org.lwjgl.opengl.GL11;

/**
 * Minecraft 1.8.9 on Ornithe (Fabric Loader). The same code as the Forge build, with Forge's events
 * replaced by mixins (in mixin/) that call the hooks here.
 */
public final class NovexClient {
	private static final String CATEGORY = "Novex Client";
	static final KeyBinding menuKey = new KeyBinding("Open Novex Client menu", Keyboard.KEY_RSHIFT, CATEGORY);
	private static final KeyBinding zoomKey = new KeyBinding("Zoom", Keyboard.KEY_C, CATEGORY);
	private static boolean smoothBeforeZoom;
	/** 1.8.9 has no toggle-sprint option, so the client keeps the state itself. */
	private static boolean sprintToggled;
	private static boolean sprintWasDown;

	/** Motion blur level currently loaded, or 0 when it's off. */
	private static int blurLoaded;

	private NovexClient() {}

	/** Key bindings the game adds to its controls list (see GameSettingsMixin). */
	public static KeyBinding[] keys() {
		return new KeyBinding[] {menuKey, zoomKey};
	}

	/** Start of Minecraft.startGame, before options and resources load. */
	public static void init() {
		NovexCore.init(net.fabricmc.loader.api.FabricLoader.getInstance().getConfigDir());
		NovexCore.modules = Module.values();
	}

	/** End of Minecraft.startGame, once the resource manager exists. */
	public static void started() {
		((net.minecraft.client.resources.IReloadableResourceManager) Minecraft.getMinecraft().getResourceManager())
				.registerReloadListener(new net.minecraft.client.resources.IResourceManagerReloadListener() {
					public void onResourceManagerReload(net.minecraft.client.resources.IResourceManager manager) {
						CustomSky.reset();
					}
				});
	}

	/** End of each client tick. */
	public static void tick() {
		Minecraft mc = Minecraft.getMinecraft();
		SelfTest.tick();
		while (menuKey.isPressed()) mc.displayGuiScreen(new NovexScreen(mc.currentScreen, true));

		// Smooth camera while zoomed, like a spyglass; put the player's own choice back afterwards.
		boolean z = NovexCore.config.zoom && zoomKey.isKeyDown() && mc.currentScreen == null;
		if (z && !NovexCore.zooming) {
			smoothBeforeZoom = mc.gameSettings.smoothCamera;
			mc.gameSettings.smoothCamera = true;
		} else if (!z && NovexCore.zooming) {
			mc.gameSettings.smoothCamera = smoothBeforeZoom;
		}
		NovexCore.zooming = z;

		motionBlur(mc);
		Optimizer.enableVbos(mc);

		// 1.7 block hit: holding attack while blocking swings the sword. This only starts the local
		// swing animation; nothing is sent to the server, so it doesn't change hits.
		EntityPlayerSP p = mc.thePlayer;
		if (NovexCore.config.oldBlockHit && p != null && mc.currentScreen == null && p.isUsingItem()
				&& mc.gameSettings.keyBindAttack.isKeyDown()
				// Only while aimed at a block or a mob: swinging at air doesn't keep the arm going.
				&& mc.objectMouseOver != null && mc.objectMouseOver.typeOfHit != net.minecraft.util.MovingObjectPosition.MovingObjectType.MISS
				&& (!p.isSwingInProgress || p.swingProgressInt >= 3 || p.swingProgressInt < 0)) {
			p.swingProgressInt = -1;
			p.isSwingInProgress = true;
		}

		KeyBinding sprint = mc.gameSettings.keyBindSprint;
		if (NovexCore.config.toggleSprint && mc.thePlayer != null) {
			boolean down = Keyboard.isCreated() && sprint.getKeyCode() > 0 && Keyboard.isKeyDown(sprint.getKeyCode());
			if (down && !sprintWasDown && mc.currentScreen == null) sprintToggled = !sprintToggled;
			sprintWasDown = down;
			if (sprintToggled) KeyBinding.setKeyBindState(sprint.getKeyCode(), true);
		} else if (sprintToggled) {
			sprintToggled = false;
			KeyBinding.setKeyBindState(sprint.getKeyCode(), false);
		}
	}

	/**
	 * Motion blur: Novex's camera motion blur shader (see MotionBlur). Reapplied if the game drops it
	 * (resizing, F5 spectating), and only removed if it's still ours.
	 */
	private static void motionBlur(Minecraft mc) {
		EntityRenderer r = mc.entityRenderer;
		int want = NovexCore.config.motionBlur && mc.theWorld != null ? 1 : 0;
		boolean ours = r.isShaderActive() && r.getShaderGroup() != null
				&& r.getShaderGroup().getShaderGroupName().equals("novex_client:shaders/post/motion_blur.json");
		if (want > 0 && !ours) {
			// Leave other shaders (a spectated mob's view, super secret settings) alone.
			if (r.isShaderActive()) return;
			MotionTexture.register();
			((dev.novex.client.mixin.EntityRendererAccessor) r).novex$loadShader(new ResourceLocation("novex_client", "shaders/post/motion_blur.json"));
			blurLoaded = want;
		} else if (want == 0 && blurLoaded != 0) {
			if (ours) r.stopUseShader();
			blurLoaded = 0;
		}
	}

	private static final int TITLE_BUTTON = 0x4e58;

	/** A Novex Client button on the title screen, above Singleplayer. */
	public static void titleButtons(GuiMainMenu gui, List<GuiButton> buttons) {
		// Custom home page: Novex's own title screen instead of Minecraft's.
		if (NovexCore.config.customHome) {
			Minecraft.getMinecraft().displayGuiScreen(NovexScreen.home());
			return;
		}
		if (NovexCore.config.titleButton)
			buttons.add(new GuiButton(TITLE_BUTTON, gui.width / 2 - 100, gui.height / 4 + 24, dev.novex.client.core.Lang.tr("Novex Client")));
	}

	/** Whether the title screen button was the Novex one (and it opened the menu). */
	public static boolean titleButton(GuiMainMenu gui, GuiButton button) {
		if (button.id != TITLE_BUTTON) return false;
		Minecraft.getMinecraft().displayGuiScreen(new NovexScreen(gui, true));
		return true;
	}

	/** The menu key opens the menu from any other screen too (menus, inventories, pause). */
	public static void screenKey(GuiScreen gui) {
		if (Keyboard.getEventKeyState() && Keyboard.getEventKey() == menuKey.getKeyCode()
				&& !(gui instanceof NovexScreen) && !(gui instanceof GuiChat))
			Minecraft.getMinecraft().displayGuiScreen(new NovexScreen(gui, true));
	}

	/** The blur shader needs this frame's camera turn, so update it every frame, not every tick. */
	public static void frame() {
		if (blurLoaded != 0) MotionTexture.update();
	}

	/** A mouse button event while playing (no screen open). */
	public static void mouse(int button, boolean pressed) {
		if (pressed && Minecraft.getMinecraft().currentScreen == null) Clicks.press(button);
	}

	/** Camera stabilize on servers: steadies what's drawn only, so the player's real aim is untouched. */
	private static boolean steadyView() {
		Minecraft mc = Minecraft.getMinecraft();
		return !mc.isSingleplayer() && mc.gameSettings.thirdPersonView == 0 && mc.thePlayer != null
				&& mc.getRenderViewEntity() == mc.thePlayer;
	}

	public static float viewYaw(float yaw) {
		return steadyView() ? Stabilizer.viewYaw(yaw) : yaw;
	}

	public static float viewPitch(float pitch) {
		return steadyView() ? Stabilizer.viewPitch(pitch) : pitch;
	}

	/** FOV effects off: no widening when sprinting or flying, no narrowing when drawing a bow. */
	public static float fov(float fov) {
		return NovexCore.zoomedFov(NovexCore.config.fovEffects ? fov : 1f);
	}

	/** After the vanilla HUD. */
	public static void overlay() {
		Hud.draw(gfx(), GAME);
		GlStateManager.color(1f, 1f, 1f, 1f);
	}

	static Gfx gfx() {
		return gfx(new ScaledResolution(Minecraft.getMinecraft()));
	}

	static Gfx gfx(final ScaledResolution res) {
		final Minecraft mc = Minecraft.getMinecraft();
		final FontRenderer font = mc.fontRendererObj;
		return new Gfx() {
			public int width() { return res.getScaledWidth(); }
			public int height() { return res.getScaledHeight(); }
			public float pixels() { return res.getScaleFactor(); }

			public void push(float x, float y, float scale) {
				GlStateManager.pushMatrix();
				GlStateManager.translate(x, y, 0);
				GlStateManager.scale(scale, scale, 1);
			}

			public void pop() { GlStateManager.popMatrix(); }

			public boolean icon(String id, int x, int y) {
				ItemStack stack = NovexClient.icon(id);
				if (stack != null) item(stack, x, y);
				return stack != null;
			}

			public boolean symbol(int codepoint, int x, int y, boolean big, int color) {
				SmoothFont font = big ? SmoothFont.BIG_ICONS : SmoothFont.ICONS;
				String s = new String(Character.toChars(codepoint));
				if (!font.can(s, res.getScaleFactor())) return false;
				font.draw(s, x, y, color);
				return true;
			}

			public void clip(int x1, int y1, int x2, int y2) {
				int f = res.getScaleFactor();
				GL11.glEnable(GL11.GL_SCISSOR_TEST);
				GL11.glScissor(x1 * f, mc.displayHeight - y2 * f, (x2 - x1) * f, (y2 - y1) * f);
			}

			public void noClip() { GL11.glDisable(GL11.GL_SCISSOR_TEST); }
			public void fill(int x1, int y1, int x2, int y2, int color) { Gui.drawRect(x1, y1, x2, y2, color); }
			public void text(String s, int x, int y, int color, boolean shadow) {
				if (NovexCore.uiFont && SmoothFont.UI.can(s, res.getScaleFactor())) SmoothFont.UI.draw(s, x, y, color);
				else font.drawString(s, x, y, color, shadow);
			}

			public int textWidth(String s) {
				return NovexCore.uiFont && SmoothFont.UI.can(s, res.getScaleFactor()) ? SmoothFont.UI.width(s) : font.getStringWidth(s);
			}
			public int lineHeight() { return font.FONT_HEIGHT; }

			public void item(Object stack, int x, int y) {
				RenderHelper.enableGUIStandardItemLighting();
				mc.getRenderItem().renderItemAndEffectIntoGUI((ItemStack) stack, x, y);
				RenderHelper.disableStandardItemLighting();
			}
		};
	}


	private static final java.util.Map<String, ItemStack> ICONS = new java.util.HashMap<String, ItemStack>();

	/** Item stacks for module icons, by id; null when this version has no such item. */
	static ItemStack icon(String id) {
		if (!ICONS.containsKey(id)) {
			net.minecraft.item.Item item = net.minecraft.item.Item.getByNameOrId(id);
			ICONS.put(id, item == null ? null : new ItemStack(item));
		}
		return ICONS.get(id);
	}

	static final Game GAME = new Game() {
		private Minecraft mc() { return Minecraft.getMinecraft(); }

		public boolean active() { return mc().thePlayer != null && !mc().gameSettings.showDebugInfo; }
		public int fps() { return Minecraft.getDebugFPS(); }

		public int ping() {
			Minecraft mc = mc();
			if (mc.isSingleplayer() || mc.getNetHandler() == null) return -1;
			NetworkPlayerInfo info = mc.getNetHandler().getPlayerInfo(mc.thePlayer.getUniqueID());
			return info == null ? -1 : info.getResponseTime();
		}

		public double x() { return mc().thePlayer.posX; }
		public double y() { return mc().thePlayer.posY; }
		public double z() { return mc().thePlayer.posZ; }
		public String facing() { return mc().thePlayer.getHorizontalFacing().getName(); }

		public boolean down(Key key) {
			net.minecraft.client.settings.GameSettings o = mc().gameSettings;
			switch (key) {
				case UP: return o.keyBindForward.isKeyDown();
				case LEFT: return o.keyBindLeft.isKeyDown();
				case DOWN: return o.keyBindBack.isKeyDown();
				case RIGHT: return o.keyBindRight.isKeyDown();
				case JUMP: return o.keyBindJump.isKeyDown();
				case ATTACK: return o.keyBindAttack.isKeyDown();
				default: return o.keyBindUseItem.isKeyDown();
			}
		}

		public List<Piece> armor() {
			List<Piece> out = new ArrayList<Piece>();
			// getCurrentArmor counts from boots (0) to helmet (3).
			for (int i = 3; i >= 0; i--) add(out, mc().thePlayer.getCurrentArmor(i));
			add(out, mc().thePlayer.getHeldItem());
			return out;
		}

		private void add(List<Piece> out, ItemStack s) {
			if (s != null)
				out.add(Hud.piece(s, s.isItemStackDamageable(), s.getMaxDamage(), s.getItemDamage(), s.stackSize));
		}

		public List<Effect> effects() {
			List<Effect> out = new ArrayList<Effect>();
			for (PotionEffect e : mc().thePlayer.getActivePotionEffects())
				out.add(new Effect(I18n.format(e.getEffectName()), e.getAmplifier(), e.getDuration(), e.getIsPotionDurationMax()));
			return out;
		}

		public int blocksToBuildLimit() {
			return Math.max(0, NovexCore.config.buildHeight - (int) Math.floor(mc().thePlayer.posY));
		}
	};
}
