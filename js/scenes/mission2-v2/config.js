/* Independent visual-variant configuration; gameplay coordinates mirror Legacy. */
(function(root) {
    const grid = [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 2, 0, 0, 5, 0, 1, 1, 0, 0, 0, 0, 3, 1],
        [1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 4, 1],
        [1, 0, 1, 0, 0, 6, 0, 0, 0, 0, 1, 1, 0, 1],
        [1, 0, 1, 1, 0, 0, 1, 1, 5, 0, 4, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1],
        [1, 1, 1, 0, 0, 1, 1, 0, 6, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0, 1],
        [1, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 5, 0, 0, 1, 1, 0, 1],
        [1, 1, 0, 1, 1, 1, 0, 6, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 4, 0, 0, 0, 1, 1, 0, 1, 1],
        [1, 0, 5, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ];
    grid.forEach(Object.freeze);
    const config = Object.freeze({ id: 'mission2-v2', overviewRadius: 3800, cellSize: 150, offsetX: -1050, offsetZ: -1050,
        grid: Object.freeze(grid), spawn: Object.freeze({x:-825,y:14,z:-825,heading:180}),
        goal: Object.freeze({x:825,z:-825}),
        legend: Object.freeze([
            {swatchClass:'brief-legend-swatch--fire',glyph:'H',title:'起點（基地）',desc:'橙色 H 起飛坪；旁邊是林務救援站'},
            {swatchClass:'brief-legend-swatch--end',glyph:'H',title:'終點（受災區）',desc:'綠色 H 救援平台；鄰近救援棚與火點 A'},
            {swatchClass:'brief-legend-swatch--fire',glyph:'A',title:'火點 A/B/C/D',desc:'燒灼地面與火焰；A 最優先（+200）'},
            {swatchClass:'brief-legend-swatch--water',glyph:'',title:'水源',desc:'藍色蓄水池、石岸與取水標誌；Collect Water 裝水'},
            {swatchClass:'brief-legend-swatch--charge',glyph:'',title:'充電站',desc:'黃色補給坪與設備櫃；hover ≥3 秒 +15 行'},
            {swatchClass:'brief-legend-swatch--forest',glyph:'',title:'樹林／岩石',desc:'林帶、岩石與燒灼區定義障礙格；沿土色便道規劃'}
        ].map(Object.freeze)),
        palette: Object.freeze({grass:0x798863, trail:0xc6b18c, verge:0x9a9c73, stone:0x92968b,
            bark:0x665547, foliage:0x476951, foliageLight:0x668361, paper:0xf4eddb,
            teal:0x28564e, orange:0xc95f32, water:0x528b9e, dark:0x394a42}) });
    root.Mission2V2Config = config;
    if (typeof module === 'object' && module.exports) module.exports = config;
})(typeof globalThis !== 'undefined' ? globalThis : this);
