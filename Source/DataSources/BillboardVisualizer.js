/*global define*/
define([
        '../Core/AssociativeArray',
        '../Core/BoundingRectangle',
        '../Core/Cartesian2',
        '../Core/Cartesian3',
        '../Core/Color',
        '../Core/defaultValue',
        '../Core/defined',
        '../Core/destroyObject',
        '../Core/DeveloperError',
        '../Core/DistanceDisplayCondition',
        '../Core/NearFarScalar',
        '../Scene/HeightReference',
        '../Scene/HorizontalOrigin',
        '../Scene/VerticalOrigin',
        './BoundingSphereState',
        './EntityCluster',
        './Property'
    ], function(
        AssociativeArray,
        BoundingRectangle,
        Cartesian2,
        Cartesian3,
        Color,
        defaultValue,
        defined,
        destroyObject,
        DeveloperError,
        DistanceDisplayCondition,
        NearFarScalar,
        HeightReference,
        HorizontalOrigin,
        VerticalOrigin,
        BoundingSphereState,
        EntityCluster,
        Property) {
    'use strict';

    var defaultColor = Color.WHITE;
    var defaultEyeOffset = Cartesian3.ZERO;
    var defaultHeightReference = HeightReference.NONE;
    var defaultPixelOffset = Cartesian2.ZERO;
    var defaultScale = 1.0;
    var defaultRotation = 0.0;
    var defaultAlignedAxis = Cartesian3.ZERO;
    var defaultHorizontalOrigin = HorizontalOrigin.CENTER;
    var defaultVerticalOrigin = VerticalOrigin.CENTER;
    var defaultSizeInMeters = false;

    var position = new Cartesian3();
    var color = new Color();
    var eyeOffset = new Cartesian3();
    var pixelOffset = new Cartesian2();
    var scaleByDistance = new NearFarScalar();
    var translucencyByDistance = new NearFarScalar();
    var pixelOffsetScaleByDistance = new NearFarScalar();
    var boundingRectangle = new BoundingRectangle();
    var distanceDisplayCondition = new DistanceDisplayCondition();

    function EntityData(entity) {
        this.entity = entity;
        this.billboard = undefined;
        this.textureValue = undefined;
    }

    /**
     * A {@link Visualizer} which maps {@link Entity#billboard} to a {@link Billboard}.
     * @alias BillboardVisualizer
     * @constructor
     *
     * @param {EntityCluster} entityCluster The entity cluster to manage the collection of billboards and optionally cluster with other entities.
     * @param {EntityCollection} entityCollection The entityCollection to visualize.
     */
    function BillboardVisualizer(entityCluster, entityCollection) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(entityCluster)) {
            throw new DeveloperError('entityCluster is required.');
        }
        if (!defined(entityCollection)) {
            throw new DeveloperError('entityCollection is required.');
        }
        //>>includeEnd('debug');

        entityCollection.collectionChanged.addEventListener(BillboardVisualizer.prototype._onCollectionChanged, this);

        this._cluster = entityCluster;
        this._entityCollection = entityCollection;
        this._items = new AssociativeArray();
        this._onCollectionChanged(entityCollection, entityCollection.values, [], []);
    }

    /**
     * Updates the primitives created by this visualizer to match their
     * Entity counterpart at the given time.
     *
     * @param {JulianDate} time The time to update to.
     * @returns {Boolean} This function always returns true.
     */
    BillboardVisualizer.prototype.update = function(time) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(time)) {
            throw new DeveloperError('time is required.');
        }
        //>>includeEnd('debug');

        var items = this._items.values;
        var cluster = this._cluster;

        for (var i = 0, len = items.length; i < len; i++) {
            var item = items[i];
            var entity = item.entity;
            var billboardGraphics = entity._billboard;
            var textureValue;
            var billboard = item.billboard;
            var show = entity.isShowing && entity.isAvailable(time) && Property.getValueOrDefault(billboardGraphics._show, time, true);

            if (show) {
                position = Property.getValueOrUndefined(entity._position, time, position);
                textureValue = Property.getValueOrUndefined(billboardGraphics._image, time);
                show = defined(position) && defined(textureValue);
            }

            if (!show) {
                //don't bother creating or updating anything else
                returnPrimitive(item, entity, cluster);
                continue;
            }

            if (!Property.isConstant(entity._position)) {
                cluster._clusterDirty = true;
            }

            if (!defined(billboard)) {
                billboard = cluster.getBillboard(entity);
                billboard.id = entity;
                billboard.image = undefined;
                item.billboard = billboard;
            }

            billboard.show = show;
            if (!defined(billboard.image) || item.textureValue !== textureValue) {
                billboard.image = textureValue;
                item.textureValue = textureValue;
            }
            billboard.position = position;
            billboard.color = Property.getValueOrDefault(billboardGraphics._color, time, defaultColor, color);
            billboard.eyeOffset = Property.getValueOrDefault(billboardGraphics._eyeOffset, time, defaultEyeOffset, eyeOffset);
            billboard.heightReference = Property.getValueOrDefault(billboardGraphics._heightReference, time, defaultHeightReference);
            billboard.pixelOffset = Property.getValueOrDefault(billboardGraphics._pixelOffset, time, defaultPixelOffset, pixelOffset);
            billboard.scale = Property.getValueOrDefault(billboardGraphics._scale, time, defaultScale);
            billboard.rotation = Property.getValueOrDefault(billboardGraphics._rotation, time, defaultRotation);
            billboard.alignedAxis = Property.getValueOrDefault(billboardGraphics._alignedAxis, time, defaultAlignedAxis);
            billboard.horizontalOrigin = Property.getValueOrDefault(billboardGraphics._horizontalOrigin, time, defaultHorizontalOrigin);
            billboard.verticalOrigin = Property.getValueOrDefault(billboardGraphics._verticalOrigin, time, defaultVerticalOrigin);
            billboard.width = Property.getValueOrUndefined(billboardGraphics._width, time);
            billboard.height = Property.getValueOrUndefined(billboardGraphics._height, time);
            billboard.scaleByDistance = Property.getValueOrUndefined(billboardGraphics._scaleByDistance, time, scaleByDistance);
            billboard.translucencyByDistance = Property.getValueOrUndefined(billboardGraphics._translucencyByDistance, time, translucencyByDistance);
            billboard.pixelOffsetScaleByDistance = Property.getValueOrUndefined(billboardGraphics._pixelOffsetScaleByDistance, time, pixelOffsetScaleByDistance);
            billboard.sizeInMeters = Property.getValueOrDefault(billboardGraphics._sizeInMeters, defaultSizeInMeters);
            billboard.distanceDisplayCondition = Property.getValueOrUndefined(billboardGraphics._distanceDisplayCondition, time, distanceDisplayCondition);

            var subRegion = Property.getValueOrUndefined(billboardGraphics._imageSubRegion, time, boundingRectangle);
            if (defined(subRegion)) {
                billboard.setImageSubRegion(billboard._imageId, subRegion);
            }
        }
        return true;
    };

    /**
     * Computes a bounding sphere which encloses the visualization produced for the specified entity.
     * The bounding sphere is in the fixed frame of the scene's globe.
     *
     * @param {Entity} entity The entity whose bounding sphere to compute.
     * @param {BoundingSphere} result The bounding sphere onto which to store the result.
     * @returns {BoundingSphereState} BoundingSphereState.DONE if the result contains the bounding sphere,
     *                       BoundingSphereState.PENDING if the result is still being computed, or
     *                       BoundingSphereState.FAILED if the entity has no visualization in the current scene.
     * @private
     */
    BillboardVisualizer.prototype.getBoundingSphere = function(entity, result) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(entity)) {
            throw new DeveloperError('entity is required.');
        }
        if (!defined(result)) {
            throw new DeveloperError('result is required.');
        }
        //>>includeEnd('debug');

        var item = this._items.get(entity.id);
        if (!defined(item) || !defined(item.billboard)) {
            return BoundingSphereState.FAILED;
        }

        var billboard = item.billboard;
        if (billboard.heightReference === HeightReference.NONE) {
            result.center = Cartesian3.clone(billboard.position, result.center);
        } else {
            if (!defined(billboard._clampedPosition)) {
                return BoundingSphereState.PENDING;
            }
            result.center = Cartesian3.clone(billboard._clampedPosition, result.center);
        }
        result.radius = 0;
        return BoundingSphereState.DONE;
    };

    /**
     * Returns true if this object was destroyed; otherwise, false.
     *
     * @returns {Boolean} True if this object was destroyed; otherwise, false.
     */
    BillboardVisualizer.prototype.isDestroyed = function() {
        return false;
    };

    /**
     * Removes and destroys all primitives created by this instance.
     */
    BillboardVisualizer.prototype.destroy = function() {
        this._entityCollection.collectionChanged.removeEventListener(BillboardVisualizer.prototype._onCollectionChanged, this);
        var entities = this._entityCollection.values;
        for (var i = 0; i < entities.length; i++) {
            this._cluster.removeBillboard(entities[i]);
        }
        return destroyObject(this);
    };

    BillboardVisualizer.prototype._onCollectionChanged = function(entityCollection, added, removed, changed) {
        var i;
        var entity;
        var items = this._items;
        var cluster = this._cluster;

        for (i = added.length - 1; i > -1; i--) {
            entity = added[i];
            if (defined(entity._billboard) && defined(entity._position)) {
                items.set(entity.id, new EntityData(entity));
            }
        }

        for (i = changed.length - 1; i > -1; i--) {
            entity = changed[i];
            if (defined(entity._billboard) && defined(entity._position)) {
                if (!items.contains(entity.id)) {
                    items.set(entity.id, new EntityData(entity));
                }
            } else {
                returnPrimitive(items.get(entity.id), entity, cluster);
                items.remove(entity.id);
            }
        }

        for (i = removed.length - 1; i > -1; i--) {
            entity = removed[i];
            returnPrimitive(items.get(entity.id), entity, cluster);
            items.remove(entity.id);
        }
    };

    function returnPrimitive(item, entity, cluster) {
        if (defined(item)) {
            item.billboard = undefined;
            cluster.removeBillboard(entity);
        }
    }

    return BillboardVisualizer;
});
