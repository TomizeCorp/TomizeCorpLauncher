package fr.tomizecorp.epsilon;

import java.io.InputStream;
import java.nio.ByteBuffer;
import org.lwjgl.glfw.GLFW;
import org.lwjgl.glfw.GLFWImage;
import org.lwjgl.stb.STBImage;
import org.lwjgl.system.MemoryStack;
import org.lwjgl.system.MemoryUtil;

public final class EpsilonBranding {
    public static final String TITLE = "EPSILON — TomizeCorp";
    public static final String SERVER = "play.minecraft.epsilon.tomize.fr:25568";

    private EpsilonBranding() {}

    public static void setTitle(long handle) {
        GLFW.glfwSetWindowTitle(handle, TITLE);
    }

    public static void setIcon(long handle) {
        try (InputStream stream = EpsilonBranding.class.getResourceAsStream("/assets/epsilon/icon.png")) {
            if (stream == null) return;
            byte[] bytes = stream.readAllBytes();
            ByteBuffer encoded = MemoryUtil.memAlloc(bytes.length).put(bytes).flip();
            try (MemoryStack stack = MemoryStack.stackPush()) {
                var width = stack.mallocInt(1); var height = stack.mallocInt(1); var channels = stack.mallocInt(1);
                ByteBuffer pixels = STBImage.stbi_load_from_memory(encoded, width, height, channels, 4);
                if (pixels == null) return;
                GLFWImage.Buffer icons = GLFWImage.malloc(1, stack);
                icons.position(0).width(width.get(0)).height(height.get(0)).pixels(pixels);
                GLFW.glfwSetWindowIcon(handle, icons);
                STBImage.stbi_image_free(pixels);
            } finally { MemoryUtil.memFree(encoded); }
        } catch (Exception ignored) { }
    }
}
