/*
 * Copyright 2019 WICKLETS LLC
 *
 * This file is part of Wick Engine.
 *
 * Wick Engine is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wick Engine is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Wick Engine.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Utility class for creating and parsing wickobject files.
 */
Wick.SVGFile = class {
    /**
     * Create a project from a wick file.
     * @param {Blob | string} svgFile - WickObject file containing object data (can be a Blob or a dataURL string)
     * @param {function} callback - Function called when the object is done being loaded
     */
    static fromSVGFile(svgFile, callback) {

        if (typeof svgFile === 'string') {
            svgFile = Wick.ExportUtils.dataURItoBlob(svgFile);
        }

        var fr = new FileReader();

        fr.onload = function() {
            callback(fr.result);

        };

        fr.readAsText(svgFile);
    }

    /**
     * Create a wick file from the project.
     * @param {Wick.Timeline} timeline - the clip to create a wickobject file from
     * @param {function(string)} onError - Can be 'blob' or 'dataurl'.
     * @param {function(blob)} callback - function to call when done
     * @returns {Blob}
     */
    static toSVGFile(timeline, onError, callback) {
        var zip = new JSZip(); 
        var projectWidth = (timeline.project && timeline.project.width) ? timeline.project.width : 1280;
        var projectHeight = (timeline.project && timeline.project.height) ? timeline.project.height : 720;
        var projectName = (timeline.project && timeline.project.name) ? timeline.project.name : "WickAnimation";

        var spritemap = {
            ATLAS: { SPRITES: [] },
            meta: {
                app: "Wick Editor Texture Exporter",
                version: "1.0",
                image: "spritemap1.png",
                format: "RGBA8888",
                size: { w: 0, h: 0 },
                resolution: "1"
            }
        };

        var animation = {
            AN: {
                N: projectName,
                STI: {},
                SN: projectName,
                TL: { L: [] }
            },
            SD: { S: [] }
        };

        var uniqueFrames = [];
        var frameIndexCounter = 0;

        timeline.layers.forEach(function(layer, layerIdx) {
            var animateLayer = {
                LN: layer.name || "Layer_" + (layerIdx + 1),
                FR: []
            };

            layer.frames.forEach(function(frame) {
                if (!frame.elements || frame.elements.length === 0) {
                    animateLayer.FR.push({
                        I: frame.startFrame,
                        DU: frame.duration,
                        E: []
                    });
                    return;
                }

                var tempCanvas = document.createElement('canvas');
                tempCanvas.width = projectWidth;
                tempCanvas.height = projectHeight;
                var ctx = tempCanvas.getContext('2d');
                
                frame.render(ctx);

                var frameIdentifier = String(frameIndexCounter).padStart(4, '0');
                uniqueFrames.push({
                    name: frameIdentifier,
                    canvas: tempCanvas,
                    w: projectWidth,
                    h: projectHeight
                });

                animateLayer.FR.push({
                    I: frame.startFrame,
                    DU: frame.duration,
                    E: [{
                        SI: {
                            SN: projectName,
                            IN: "",
                            ST: "G",
                            FF: frameIndexCounter,
                            LP: "LP",
                            TRP: { x: frame.registrationX || 0, y: frame.registrationY || 0 },
                            M3D: [
                                1, 0, 0, 0,
                                0, 1, 0, 0,
                                0, 0, 1, 0,
                                frame.x || 0, frame.y || 0, 0, 1
                            ]
                        }
                    }]
                });

                frameIndexCounter++;
            });

            animation.AN.TL.L.push(animateLayer);
        });

        if (uniqueFrames.length === 0) {
            if (typeof onError === 'function') onError("No visible elements found to export into an Atlas.");
            var failBlob = new Blob(["No frames"], { type: 'text/plain' });
            callback(failBlob);
            return failBlob;
        }

        var atlasWidth = projectWidth;
        var atlasHeight = projectHeight * uniqueFrames.length;

        var atlasCanvas = document.createElement('canvas');
        atlasCanvas.width = atlasWidth;
        atlasCanvas.height = atlasHeight;
        var atlasCtx = atlasCanvas.getContext('2d');

        uniqueFrames.forEach(function(f, index) {
            var targetY = index * projectHeight;
            atlasCtx.drawImage(f.canvas, 0, targetY);

            spritemap.ATLAS.SPRITES.push({
                SPRITE: {
                    name: f.name,
                    x: 0,
                    y: targetY,
                    w: f.w,
                    h: f.h,
                    rotated: false
                }
            });
        });

        spritemap.meta.size = { w: atlasWidth, h: atlasHeight };

        zip.file("spritemap1.json", JSON.stringify(spritemap, null, 2));
        zip.file("animation.json", JSON.stringify(animation, null, 2));

        atlasCanvas.toBlob(function(blob) {
            zip.file("spritemap1.png", blob);
            
            zip.generateAsync({ type: "blob" }).then(function(content) {
                if (typeof callback === 'function') {
                    callback(content);
                }
            });
        }, "image/png");

        // Returns an execution-safe mock container to satisfy synchronous code flows
        return new Blob([], { type: 'application/zip' });
    }
}