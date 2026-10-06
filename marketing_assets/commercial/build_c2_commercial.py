import bpy
import math
import os
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
OUT = os.path.join(ROOT, "marketing_assets", "commercial", "output")
ASSETS = os.path.join(ROOT, "ios_app_store_screenshots")
os.makedirs(OUT, exist_ok=True)

FPS = 30
END_FRAME = 750  # 25 seconds
W, H = 1080, 1920

def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.materials, bpy.data.curves, bpy.data.meshes, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)

def mat(name, color, metallic=0.0, roughness=0.45, emission=None):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = 0.4
    return m

def rounded_cube(name, location, scale, material, bevel=0.2):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    modifier = obj.modifiers.new("Soft edges", "BEVEL")
    modifier.width = bevel
    modifier.segments = 6
    return obj

def sphere(name, location, scale, material):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(material)
    return obj

def text_object(body, location, size, material, align="CENTER"):
    curve = bpy.data.curves.new(body[:16], "FONT")
    curve.body = body
    curve.align_x = align
    curve.align_y = "CENTER"
    curve.size = size
    curve.extrude = 0.012
    curve.bevel_depth = 0.006
    obj = bpy.data.objects.new(body[:16], curve)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (math.radians(90), 0, 0)
    obj.data.materials.append(material)
    return obj

def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()

def add_area(name, location, energy, color, size):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.color = color
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    look_at(obj, (0, 0, 0))
    return obj

def image_material(name, path):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nodes = m.node_tree.nodes
    links = m.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(path, check_existing=True)
    emission.inputs["Strength"].default_value = 0.8
    links.new(tex.outputs["Color"], emission.inputs["Color"])
    links.new(emission.outputs["Emission"], out.inputs["Surface"])
    return m

def add_screen(name, image_path, y=-0.43):
    bpy.ops.mesh.primitive_plane_add(size=2, location=(0, y, 0), rotation=(math.radians(90), 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (2.48, 5.36, 1)
    obj.data.materials.append(image_material(name + " Material", image_path))
    return obj

def animate_visibility(obj, start, end):
    obj.hide_render = True
    obj.keyframe_insert("hide_render", frame=start - 1)
    obj.hide_render = False
    obj.keyframe_insert("hide_render", frame=start)
    obj.keyframe_insert("hide_render", frame=end)
    obj.hide_render = True
    obj.keyframe_insert("hide_render", frame=end + 1)

def add_coffee_scene():
    coffee = mat("Coffee beans", (0.09, 0.025, 0.012), roughness=0.32)
    gold = mat("Warm gold", (0.72, 0.31, 0.08), metallic=0.65, roughness=0.25)
    cream = mat("Cream ceramic", (0.82, 0.55, 0.29), metallic=0.0, roughness=0.25)
    for i in range(38):
        angle = i * 2.399
        radius = 2.2 + (i % 7) * 0.35
        z = -4.7 + (i % 4) * 0.16
        bean = sphere("Coffee bean", (math.cos(angle) * radius, 1.0 + (i % 3) * 0.2, z), (0.16, 0.28, 0.10), coffee)
        bean.rotation_euler = (angle, angle * 0.6, angle * 0.4)
    cup = rounded_cube("C2 coffee cup", (-3.7, 0.7, -3.7), (1.1, 0.9, 1.05), cream, 0.35)
    cup.rotation_euler[1] = math.radians(-7)
    sphere("Coffee surface", (-3.7, -0.05, -2.68), (0.9, 0.72, 0.12), coffee)
    for i in range(4):
        steam = bpy.data.curves.new("Steam", "CURVE")
        steam.dimensions = "3D"
        steam.bevel_depth = 0.035
        spline = steam.splines.new("BEZIER")
        spline.bezier_points.add(3)
        for j, p in enumerate(spline.bezier_points):
            p.co = (-3.7 + math.sin(i + j) * 0.10, 0.5, -2.4 + j * 0.7)
            p.handle_left_type = "AUTO"
            p.handle_right_type = "AUTO"
        steam_obj = bpy.data.objects.new("Steam", steam)
        bpy.context.collection.objects.link(steam_obj)
        steam.materials.append(mat("Steam", (0.9, 0.75, 0.58), emission=(0.9, 0.75, 0.58)))

def main():
    clear_scene()
    dark = mat("Backdrop", (0.035, 0.012, 0.008), roughness=0.6)
    phone = mat("Phone frame", (0.008, 0.006, 0.005), metallic=0.75, roughness=0.18)
    glass = mat("Screen glass", (0.03, 0.03, 0.03), metallic=0.1, roughness=0.08)
    white = mat("Cream text", (0.98, 0.89, 0.72), emission=(0.98, 0.89, 0.72))
    gold = mat("Gold text", (0.76, 0.35, 0.08), emission=(0.76, 0.35, 0.08))

    # Backdrop and ground.
    rounded_cube("Backdrop", (0, 3.0, 0), (8.5, 0.4, 10), dark, 0.3)
    rounded_cube("Ground", (0, 0.5, -5.7), (8.5, 6.0, 0.25), dark, 0.2)
    add_coffee_scene()

    # 3D phone with a screen that switches between the real app posters.
    body = rounded_cube("C2 App Phone", (0, 0, 0), (2.85, 0.35, 5.9), phone, 0.45)
    screen_frame = rounded_cube("Screen bezel", (0, -0.37, 0), (2.57, 0.08, 5.52), glass, 0.32)
    screenshot_names = ["01-home.png", "02-menu.png", "03-orders.png", "04-rewards.png"]
    screens = []
    for index, filename in enumerate(screenshot_names):
        screen = add_screen("App screen " + str(index + 1), os.path.join(ASSETS, filename))
        screens.append(screen)
        animate_visibility(screen, 1 + index * 150, 150 + index * 150)

    # App feature copy behind and beside the phone.
    copy = [
        ("ORDER WITH EASE", 42, white),
        ("DISCOVER MORE", 192, gold),
        ("REWARDS THAT\nCOME BACK", 342, white),
        ("GOOD COFFEE.\nBRIGHTER DAYS.", 492, gold),
    ]
    for body_text, frame, material in copy:
        obj = text_object(body_text, (0, 0.1, 7.0), 0.68, material)
        obj.hide_render = True
        obj.keyframe_insert("hide_render", frame=frame - 1)
        obj.hide_render = False
        obj.keyframe_insert("hide_render", frame=frame)
        obj.keyframe_insert("hide_render", frame=frame + 105)
        obj.hide_render = True
        obj.keyframe_insert("hide_render", frame=frame + 106)

    end_card = rounded_cube("End card", (0, 0.9, 0), (5.8, 0.15, 5.9), dark, 0.35)
    logo_text = text_object("C2", (0, 0.55, 1.6), 2.5, white)
    cta = text_object("DOWNLOAD THE APP", (0, 0.55, -1.3), 0.62, gold)
    tagline = text_object("ORDER. EARN. ENJOY.", (0, 0.55, -2.3), 0.45, white)
    for obj in (end_card, logo_text, cta, tagline):
        obj.hide_render = True
        obj.keyframe_insert("hide_render", frame=674)
        obj.hide_render = False
        obj.keyframe_insert("hide_render", frame=675)
        obj.keyframe_insert("hide_render", frame=END_FRAME)

    # Camera and animated push-in.
    bpy.ops.object.camera_add(location=(0, -22, 0.1))
    camera = bpy.context.object
    camera.data.lens = 58
    look_at(camera, (0, 0, 0))
    camera.keyframe_insert("location", frame=1)
    camera.location.y = -18.2
    camera.keyframe_insert("location", frame=180)
    camera.location.y = -20.2
    camera.keyframe_insert("location", frame=420)
    camera.location.y = -18.0
    camera.keyframe_insert("location", frame=675)
    camera.location.y = -16.5
    camera.keyframe_insert("location", frame=END_FRAME)
    bpy.context.scene.camera = camera

    # Warm commercial lighting.
    add_area("Key light", (-6, -8, 8), 1350, (1.0, 0.55, 0.28), 6)
    add_area("Rim light", (6, 2, 5), 1100, (0.35, 0.18, 1.0), 4)
    add_area("Top light", (0, 0, 10), 900, (1.0, 0.72, 0.42), 5)

    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = END_FRAME
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = W
    scene.render.resolution_y = H
    scene.render.resolution_percentage = 50
    scene.render.fps = FPS
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = os.path.join(OUT, "frames", "frame_")
    os.makedirs(os.path.join(OUT, "frames"), exist_ok=True)
    scene.render.film_transparent = False
    scene.world.color = (0.008, 0.003, 0.002)
    scene.view_settings.look = "AgX - Medium High Contrast"

    # Save the editable scene and render the full commercial.
    blend_path = os.path.join(OUT, "c2-app-commercial.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    bpy.ops.render.render(animation=True)

if __name__ == "__main__":
    main()
