package fr.tomizecorp.epsilon;

import org.lwjgl.glfw.GLFW;

public final class EpsilonBranding {
    public static final String REVIEWS_URL = "https://avis-epsilon.tomize.fr";
    public static final String BUG_REPORT_URL = "https://discord.com/channels/1416092362744139896/1416116541061070868";
    public static final String TITLE = "EPSILON — TomizeCorp";
    public static final String SERVER = "play.minecraft.epsilon.tomize.fr:25568";

    private EpsilonBranding() {}

    public static void setTitle(long handle) {
        GLFW.glfwSetWindowTitle(handle, TITLE);
    }
}
