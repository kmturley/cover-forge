"""
Builds src/assets/models/jewel-case.glb, the CD jewel case's plastic parts for the 3D preview (src/three/JewelCase.tsx).

Source: "Compact disc and case" by effe, BlendSwap, CC0 (https://www.blendswap.com/blend/1986), opened in Blender and
exported as glTF (lid open flat, with the disc, booklet and tray card). This closes the lid, keeps the base, lid and tray,
centres them in the preview's frame (mm, hinge on -x, lid at +z), welds and re-winds the faces, and exports without
textures or UVs.

    /Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/models/export-jewel-case.py -- <source.glb> <out.glb>
"""
import math
import sys

import bpy
from mathutils import Matrix, Vector

src, out = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
objects = bpy.data.objects

# Close the lid: half a turn about the hinge, the line along y through x 5.205 mm, z 5.16 mm (which lines the lid up with
# the base: both 142 mm across, the lid's back edge level with the base's back).
lid = objects['front cover']
h, k = 5.205 / 1000, 5.16 / 1000
lid.matrix_world = Matrix.Translation((h, 0, k)) @ Matrix.Rotation(math.pi, 4, 'Y') @ Matrix.Translation((-h, 0, -k)) @ lid.matrix_world
bpy.context.view_layer.update()

keep = {'back': 'base', 'front cover': 'lid', 'cd support': 'tray'}
for o in list(bpy.context.scene.objects):
    if o.name not in keep:
        bpy.data.objects.remove(o)

# The closed case's centre, m; then everything in mm about it.
centre = Vector((0.07093, 0.06171, 0.00532))
for o in bpy.context.scene.objects:
    o.parent = None
    world = o.matrix_world.copy()
    o.data = o.data.copy()
    o.data.transform(Matrix.Translation(-centre * 1000) @ Matrix.Scale(1000, 4) @ world)
    o.matrix_world = Matrix.Identity(4)
    o.name = keep[o.name]
bpy.context.view_layer.update()

for o in bpy.context.scene.objects:
    bpy.context.view_layer.objects.active = o
    for x in bpy.context.scene.objects:
        x.select_set(x == o)
    # The model was drawn double-sided, its faces unwelded and some wound the wrong way: weld, then point every face out.
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.01)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(30))
    while o.data.uv_layers:
        o.data.uv_layers.remove(o.data.uv_layers[0])

# Written in Blender's own axes (export_yup off), which are already the preview's: x across, y up the case, z through it.
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=False, export_texcoords=False, export_materials='PLACEHOLDER', export_apply=True)
