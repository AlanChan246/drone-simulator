/* Shared by classic scripts, the service worker and Node verification.
 * Preserve retained-pending-review files until their ownership is resolved. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;if(root)root.AssetCatalog=value;})(typeof globalThis!=='undefined'?globalThis:this,function(){
    const data = {
  "district": [
    {
      "dir": "assets/models/kenney/starter-city/models/",
      "name": "building-small-a.glb",
      "role": "building"
    },
    {
      "dir": "assets/models/kenney/starter-city/models/",
      "name": "building-small-b.glb",
      "role": "building"
    },
    {
      "dir": "assets/models/kenney/starter-city/models/",
      "name": "building-small-c.glb",
      "role": "building"
    },
    {
      "dir": "assets/models/kenney/starter-city/models/",
      "name": "building-small-d.glb",
      "role": "building"
    },
    {
      "dir": "assets/models/kenney/starter-city/models/",
      "name": "building-garage.glb",
      "role": "building"
    },
    {
      "dir": "assets/models/kenney/starter-city/models/",
      "name": "grass-trees.glb",
      "role": "landscape"
    },
    {
      "dir": "assets/models/kenney/starter-city/models/",
      "name": "grass-trees-tall.glb",
      "role": "landscape"
    },
    {
      "dir": "assets/models/kenney/starter-city/models/",
      "name": "pavement-fountain.glb",
      "role": "landscape"
    },
    {
      "dir": "assets/models/kenney_city-kit-commercial_2.1/Models/GLB format/",
      "name": "building-g.glb",
      "role": "building"
    },
    {
      "dir": "assets/models/kenney_city-kit-commercial_2.1/Models/GLB format/",
      "name": "building-c.glb",
      "role": "building"
    },
    {
      "dir": "assets/models/kenney_city-kit-commercial_2.1/Models/GLB format/",
      "name": "building-skyscraper-a.glb",
      "role": "building"
    },
    {
      "dir": "assets/models/kenney_city-kit-commercial_2.1/Models/GLB format/",
      "name": "building-skyscraper-b.glb",
      "role": "building"
    }
  ],
  "preload": [
    {
      "key": "corridor",
      "path": "assets/models/corridor.glb",
      "required": true
    },
    {
      "key": "drone",
      "path": "assets/models/drone.glb",
      "required": false
    },
    {
      "key": "wildfireDrone",
      "path": "assets/models/wildfire-response-drone.glb",
      "required": false,
      "preserveMaterial": true
    },
    {
      "key": "industrialDrone",
      "path": "assets/models/industrial-intervention-drone.glb",
      "required": false,
      "preserveMaterial": true
    },
    {
      "key": "tree_pine",
      "path": "assets/models/nature/GLTF format/tree_pineTallA.glb",
      "required": false
    },
    {
      "key": "tree_small",
      "path": "assets/models/nature/GLTF format/tree_pineSmallA.glb",
      "required": false
    },
    {
      "key": "tree_oak",
      "path": "assets/models/nature/GLTF format/tree_oak.glb",
      "required": false
    },
    {
      "key": "rock",
      "path": "assets/models/nature/GLTF format/rock_smallA.glb",
      "required": false
    },
    {
      "key": "bush",
      "path": "assets/models/nature/GLTF format/plant_bushLarge.glb",
      "required": false
    },
    {
      "key": "grass",
      "path": "assets/models/nature/GLTF format/grass.glb",
      "required": false
    },
    {
      "key": "stump",
      "path": "assets/models/nature/GLTF format/stump_old.glb",
      "required": false
    },
    {
      "key": "log",
      "path": "assets/models/nature/GLTF format/log.glb",
      "required": false
    },
    {
      "key": "lily",
      "path": "assets/models/nature/GLTF format/lily_large.glb",
      "required": false
    },
    {
      "key": "fire_logs",
      "path": "assets/models/nature/GLTF format/campfire_logs.glb",
      "required": false
    },
    {
      "key": "rock_flat",
      "path": "assets/models/nature/GLTF format/rock_smallFlatA.glb",
      "required": false
    },
    {
      "key": "kenney_forest_ground_grass",
      "forestKey": "ground_grass",
      "path": "assets/models/kenney/nature/ground_grass.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_path_straight",
      "forestKey": "path_straight",
      "path": "assets/models/kenney/nature/ground_pathStraight.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_path_bend",
      "forestKey": "path_bend",
      "path": "assets/models/kenney/nature/ground_pathBend.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_path_tee",
      "forestKey": "path_tee",
      "path": "assets/models/kenney/nature/ground_pathSplit.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_path_cross",
      "forestKey": "path_cross",
      "path": "assets/models/kenney/nature/ground_pathCross.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_path_end",
      "forestKey": "path_end",
      "path": "assets/models/kenney/nature/ground_pathEnd.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_path_tile",
      "forestKey": "path_tile",
      "path": "assets/models/kenney/nature/ground_pathTile.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_river_tile",
      "forestKey": "river_tile",
      "path": "assets/models/kenney/nature/ground_riverTile.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_forest_tree_a",
      "forestKey": "forest_tree_a",
      "path": "assets/models/kenney/nature/tree_default.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_forest_tree_b",
      "forestKey": "forest_tree_b",
      "path": "assets/models/kenney/nature/tree_detailed.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_forest_tree_c",
      "forestKey": "forest_tree_c",
      "path": "assets/models/kenney/nature/tree_tall.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_forest_tree_burnt",
      "forestKey": "forest_tree_burnt",
      "path": "assets/models/kenney/nature/tree_oak_dark.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_forest_rock_a",
      "forestKey": "forest_rock_a",
      "path": "assets/models/kenney/nature/rock_largeA.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_forest_rock_b",
      "forestKey": "forest_rock_b",
      "path": "assets/models/kenney/nature/rock_largeB.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_forest_rock_flat",
      "forestKey": "forest_rock_flat",
      "path": "assets/models/kenney/nature/rock_smallFlatA.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_forest_stump",
      "forestKey": "forest_stump",
      "path": "assets/models/kenney/nature/stump_old.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_forest_fire_logs",
      "forestKey": "forest_fire_logs",
      "path": "assets/models/kenney/nature/campfire_logs.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_base_floor",
      "forestKey": "base_floor",
      "path": "assets/models/kenney/survival/floor.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_base_tent",
      "forestKey": "base_tent",
      "path": "assets/models/kenney/survival/tent.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_goal_floor",
      "forestKey": "goal_floor",
      "path": "assets/models/kenney/survival/structure-metal-floor.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_goal_shelter",
      "forestKey": "goal_shelter",
      "path": "assets/models/kenney/survival/structure-canvas.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_supply_box",
      "forestKey": "supply_box",
      "path": "assets/models/kenney/survival/box.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_supply_box_large",
      "forestKey": "supply_box_large",
      "path": "assets/models/kenney/survival/box-large.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_supply_barrel",
      "forestKey": "supply_barrel",
      "path": "assets/models/kenney/survival/barrel.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_base_sign",
      "forestKey": "base_sign",
      "path": "assets/models/kenney/survival/signpost.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_goal_sign",
      "forestKey": "goal_sign",
      "path": "assets/models/kenney/survival/signpost-single.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_fire_pit",
      "forestKey": "fire_pit",
      "path": "assets/models/kenney/survival/campfire-pit.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_charge_machine",
      "forestKey": "charge_machine",
      "path": "assets/models/kenney/factory/machine.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_charge_screen",
      "forestKey": "charge_screen",
      "path": "assets/models/kenney/factory/screen-panel-small.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_charge_pad",
      "forestKey": "charge_pad",
      "path": "assets/models/kenney/factory/indicator-special-area.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_charge_button",
      "forestKey": "charge_button",
      "path": "assets/models/kenney/factory/button-floor-round.glb",
      "required": true,
      "preserveMaterial": true
    },
    {
      "key": "kenney_forest_charge_warning",
      "forestKey": "charge_warning",
      "path": "assets/models/kenney/factory/warning-orange.glb",
      "required": true,
      "preserveMaterial": true
    }
  ],
  "roads": {
    "dir": "assets/models/kenney_city-kit-roads/Models/GLB format/",
    "files": {
      "straight": "road-straight.glb",
      "bend": "road-bend.glb",
      "cross": "road-crossroad.glb",
      "tee": "road-split.glb",
      "end": "road-end.glb"
    },
    "plot": "road-square.glb",
    "texture": "assets/models/kenney_city-kit-roads/Models/GLB format/Textures/colormap.png"
  },
  "factory": {
    "factory-kit/conveyor": "assets/models/kenney/factory-mission/factory-kit/conveyor.glb",
    "factory-kit/conveyor-long": "assets/models/kenney/factory-mission/factory-kit/conveyor-long.glb",
    "factory-kit/conveyor-corner": "assets/models/kenney/factory-mission/factory-kit/conveyor-corner.glb",
    "factory-kit/conveyor-stripe": "assets/models/kenney/factory-mission/factory-kit/conveyor-stripe.glb",
    "factory-kit/conveyor-bars": "assets/models/kenney/factory-mission/factory-kit/conveyor-bars.glb",
    "factory-kit/scanner-low": "assets/models/kenney/factory-mission/factory-kit/scanner-low.glb",
    "factory-kit/machine": "assets/models/kenney/factory-mission/factory-kit/machine.glb",
    "factory-kit/machine-window": "assets/models/kenney/factory-mission/factory-kit/machine-window.glb",
    "factory-kit/machine-bed": "assets/models/kenney/factory-mission/factory-kit/machine-bed.glb",
    "factory-kit/machine-fortified": "assets/models/kenney/factory-mission/factory-kit/machine-fortified.glb",
    "factory-kit/robot-arm-a": "assets/models/kenney/factory-mission/factory-kit/robot-arm-a.glb",
    "factory-kit/robot-arm-b": "assets/models/kenney/factory-mission/factory-kit/robot-arm-b.glb",
    "factory-kit/crane": "assets/models/kenney/factory-mission/factory-kit/crane.glb",
    "factory-kit/crane-magnet": "assets/models/kenney/factory-mission/factory-kit/crane-magnet.glb",
    "factory-kit/box-small": "assets/models/kenney/factory-mission/factory-kit/box-small.glb",
    "factory-kit/box-large": "assets/models/kenney/factory-mission/factory-kit/box-large.glb",
    "factory-kit/box-long": "assets/models/kenney/factory-mission/factory-kit/box-long.glb",
    "factory-kit/cog-a": "assets/models/kenney/factory-mission/factory-kit/cog-a.glb",
    "factory-kit/screen-panel-wide": "assets/models/kenney/factory-mission/factory-kit/screen-panel-wide.glb",
    "factory-kit/screen-small": "assets/models/kenney/factory-mission/factory-kit/screen-small.glb",
    "factory-kit/pipe-large-long": "assets/models/kenney/factory-mission/factory-kit/pipe-large-long.glb",
    "factory-kit/pipe-large-bend": "assets/models/kenney/factory-mission/factory-kit/pipe-large-bend.glb",
    "factory-kit/pipe-large-valve": "assets/models/kenney/factory-mission/factory-kit/pipe-large-valve.glb",
    "factory-kit/structure-window-wide": "assets/models/kenney/factory-mission/factory-kit/structure-window-wide.glb",
    "factory-kit/structure-doorway-wide": "assets/models/kenney/factory-mission/factory-kit/structure-doorway-wide.glb",
    "factory-kit/structure-high": "assets/models/kenney/factory-mission/factory-kit/structure-high.glb",
    "factory-kit/catwalk-straight": "assets/models/kenney/factory-mission/factory-kit/catwalk-straight.glb",
    "factory-kit/catwalk-stairs": "assets/models/kenney/factory-mission/factory-kit/catwalk-stairs.glb",
    "factory-kit/warning-orange": "assets/models/kenney/factory-mission/factory-kit/warning-orange.glb",
    "factory-kit/cone": "assets/models/kenney/factory-mission/factory-kit/cone.glb",
    "factory-kit/hopper-round": "assets/models/kenney/factory-mission/factory-kit/hopper-round.glb",
    "city-kit-industrial/building-a": "assets/models/kenney/factory-mission/city-kit-industrial/building-a.glb",
    "city-kit-industrial/building-c": "assets/models/kenney/factory-mission/city-kit-industrial/building-c.glb",
    "city-kit-industrial/building-f": "assets/models/kenney/factory-mission/city-kit-industrial/building-f.glb",
    "city-kit-industrial/building-i": "assets/models/kenney/factory-mission/city-kit-industrial/building-i.glb",
    "city-kit-industrial/building-m": "assets/models/kenney/factory-mission/city-kit-industrial/building-m.glb",
    "city-kit-industrial/detail-tank": "assets/models/kenney/factory-mission/city-kit-industrial/detail-tank.glb",
    "city-kit-industrial/detail-tank-large": "assets/models/kenney/factory-mission/city-kit-industrial/detail-tank-large.glb",
    "city-kit-industrial/shipping-container-a": "assets/models/kenney/factory-mission/city-kit-industrial/shipping-container-a.glb",
    "city-kit-industrial/shipping-container-c": "assets/models/kenney/factory-mission/city-kit-industrial/shipping-container-c.glb",
    "city-kit-industrial/solar-panel-landscape-group": "assets/models/kenney/factory-mission/city-kit-industrial/solar-panel-landscape-group.glb",
    "city-kit-industrial/windmill-low": "assets/models/kenney/factory-mission/city-kit-industrial/windmill-low.glb",
    "city-kit-industrial/water-tower": "assets/models/kenney/factory-mission/city-kit-industrial/water-tower.glb",
    "space-kit/machine_generatorLarge": "assets/models/kenney/factory-mission/space-kit/machine_generatorLarge.glb",
    "space-kit/machine_wireless": "assets/models/kenney/factory-mission/space-kit/machine_wireless.glb",
    "space-kit/craft_cargoA": "assets/models/kenney/factory-mission/space-kit/craft_cargoA.glb",
    "space-kit/rover": "assets/models/kenney/factory-mission/space-kit/rover.glb",
    "space-kit/barrels": "assets/models/kenney/factory-mission/space-kit/barrels.glb",
    "space-kit/rail": "assets/models/kenney/factory-mission/space-kit/rail.glb",
    "space-kit/rail_corner": "assets/models/kenney/factory-mission/space-kit/rail_corner.glb"
  },
  "supplemental": [
    {
      "path": "assets/models/kenney/survival/Textures/colormap.png",
      "purpose": "model-dependency-or-license"
    },
    {
      "path": "assets/models/kenney/factory/Textures/colormap.png",
      "purpose": "model-dependency-or-license"
    },
    {
      "path": "assets/models/kenney/starter-city/models/grass.glb",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney/starter-city/models/road-intersection.glb",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney/starter-city/models/road-straight-lightposts.glb",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney/starter-city/models/road-corner.glb",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney/starter-city/models/road-straight.glb",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney/starter-city/models/road-split.glb",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney/starter-city/models/pavement.glb",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney/starter-city/models/Textures/colormap.png",
      "purpose": "model-dependency-or-license"
    },
    {
      "path": "assets/models/kenney/flood/prototype/figurine.glb",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney/flood/prototype/indicator-round-a.glb",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney/flood/prototype/crate-color.glb",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney/flood/prototype/wheelchair.glb",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney/flood/prototype/flag.glb",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney/flood/suburban/building-type-c.glb",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney/flood/suburban/fence-1x4.glb",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney/flood/suburban/building-type-a.glb",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney/flood/suburban/building-type-j.glb",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney/flood/suburban/tree-large.glb",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney/flood/watercraft/boat-tug-a.glb",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney/flood/watercraft/boat-row-small.glb",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney/flood/watercraft/cargo-pile-a.glb",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney/flood/watercraft/arrow-standing.glb",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney/flood/watercraft/ramp-wide.glb",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney/flood/watercraft/buoy-flag.glb",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney/flood/watercraft/Textures/colormap.png",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney/flood/suburban/Textures/colormap.png",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney/flood/prototype/Textures/colormap.png",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney_city-kit-commercial_2.1/Models/GLB format/low-detail-building-i.glb",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney_city-kit-commercial_2.1/Models/GLB format/low-detail-building-wide-a.glb",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney_city-kit-commercial_2.1/Models/GLB format/low-detail-building-f.glb",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney_city-kit-commercial_2.1/Models/GLB format/low-detail-building-a.glb",
      "purpose": "retained-pending-review"
    },
    {
      "path": "assets/models/kenney_city-kit-commercial_2.1/Models/GLB format/Textures/colormap.png",
      "purpose": "model-dependency-or-license"
    },
    {
      "path": "assets/models/kenney_city-kit-roads/Models/GLB format/Textures/colormap.png",
      "purpose": "model-dependency-or-license"
    },
    {
      "path": "assets/models/kenney/factory-mission/city-kit-industrial/License.txt",
      "purpose": "model-dependency-or-license"
    },
    {
      "path": "assets/models/kenney/factory-mission/space-kit/License.txt",
      "purpose": "model-dependency-or-license"
    },
    {
      "path": "assets/models/kenney/factory-mission/factory-kit/License.txt",
      "purpose": "model-dependency-or-license"
    },
    {
      "path": "assets/models/kenney/factory-mission/factory-kit/Textures/colormap.png",
      "purpose": "model-dependency-or-license"
    },
    {
      "path": "assets/models/kenney/factory-mission/city-kit-industrial/Textures/colormap.png",
      "purpose": "model-dependency-or-license"
    }
  ]
};
    function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
    const offline = [...new Set([
        ...data.district.map(entry=>entry.dir+entry.name),
        ...data.preload.map(entry=>entry.path),
        ...Object.values(data.roads.files).map(name=>data.roads.dir+name),
        data.roads.dir+data.roads.plot, data.roads.texture,
        ...Object.values(data.factory), ...data.supplemental.map(entry=>entry.path)
    ])];
    return freeze({...data,offline});
});
