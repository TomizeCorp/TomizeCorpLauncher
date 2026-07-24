package fr.tomizecorp.epsilon;

import net.minecraft.client.option.KeyBinding;
import org.lwjgl.glfw.GLFW;

public final class TomizeKeyBindings {
    public static final KeyBinding WAYPOINTS = new KeyBinding(
            "key.tomizecorp.waypoints", GLFW.GLFW_KEY_B, KeyBinding.Category.GAMEPLAY);

    private TomizeKeyBindings() {}
}
