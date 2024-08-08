Sunniesnow.DebugBoard = class DebugBoard extends PIXI.Container {

	static async load() {
		this.mainColor = 0xff00ff;
		this.touchGeometry = this.createTouchGeometry();
		this.touchAreaGeometry = this.createTouchAreaGeometry();
		this.pinnedPointGeometry = this.createPinnedPointGeometry();
		this.eventInfoTipHighlightLifeTime = 15; // frames
		this.touchUiLifeTime = 15; // frames
	}

	constructor() {
		super();
		this.touches = {};
		this.endedTouches = new Set();
		this.pinnedPoints = [];
		this.touchAreas = [];
		this.earlyLateTexts = [];
		this.eventInfoTipHighlights = new Set();
		this.addTouchListeners();
		this.movingPointsOfTouches = new WeakMap();
	}

	addTouchListeners() {
		Sunniesnow.TouchManager.addStartListener(this.touchStartListener = this.touchStart.bind(this), 200)
		Sunniesnow.TouchManager.addEndListener(this.touchEndListener = this.touchEnd.bind(this), 200);
	}

	removeTouchListeners() {
		Sunniesnow.TouchManager.removeStartListener(this.touchStartListener);
		Sunniesnow.TouchManager.removeEndListener(this.touchEndListener);
	}

	static createTouchGeometry() {
		this.touchRadius = Sunniesnow.Config.WIDTH / 180;
		const graphics = new PIXI.Graphics();
		graphics.beginFill(this.mainColor, 0.5);
		graphics.drawCircle(0, 0, this.touchRadius);
		graphics.endFill();
		return graphics.geometry;
	}

	static createTouchAreaGeometry() {
		const radius = Sunniesnow.Config.NOTE_RADIUS * Sunniesnow.game.settings.noteHitSize;
		const graphics = new PIXI.Graphics();
		graphics.beginFill(this.mainColor, 0.1);
		if (Sunniesnow.game.settings.scroll) {
			graphics.drawRect(-radius, 0, radius*2, Sunniesnow.Config.HEIGHT);
		} else {
			graphics.drawRect(-radius, -radius, radius*2, radius*2);
		}
		graphics.endFill();
		return graphics.geometry;
	}

	static createPinnedPointGeometry() {
		this.pinnedPointRadius = Sunniesnow.Config.WIDTH / 90;
		this.pinnedPointThickness = Sunniesnow.Config.WIDTH / 360;
		const graphics = new PIXI.Graphics();
		graphics.lineStyle(this.pinnedPointThickness, this.mainColor);
		graphics.moveTo(0, -this.pinnedPointRadius);
		graphics.lineTo(0, this.pinnedPointRadius);
		graphics.moveTo(-this.pinnedPointRadius, 0);
		graphics.lineTo(this.pinnedPointRadius, 0);
		graphics.finishPoly();
		return graphics.geometry;
	}

	update(delta) {
		if (Sunniesnow.game.settings.hideDebugExceptPause) {
			this.visible = Sunniesnow.Music.pausing;
		}
		this.updateTouches(delta);
		this.updatePinnedPoints(delta);
		this.updateEarlyLateTexts(delta);
		this.updateTouchAreas(delta);
		this.updateEventInfoTipHighlights(delta);
	}

	clear() {
		this.removeTouchListeners();
		for (const touchUi of Object.values(this.touches)) {
			touchUi.destroy({children: true});
			this.removeChild(touchUi);
		}
		for (const point of this.pinnedPoints) {
			point.destroy({children: true});
			this.removeChild(point);
		}
		for (const earlyLateText of this.earlyLateTexts) {
			earlyLateText.destroy();
			this.removeChild(earlyLateText);
		}
		for (const touchArea of this.touchAreas) {
			touchArea.destroy();
			this.removeChild(touchArea);
		}
		this.touches = {};
		this.pinnedPoints = [];
		this.earlyLateTexts = [];
		this.touchAreas = [];
		Sunniesnow.PinnedCoordinates.clear();
	}

	touchStart(touch) {
		this.addTouchUi(touch);
		if (!this.visible) {
			return false;
		}
		if (touch.ctrlKey && touch.button === 0) { // ctrl + left click
			this.pinPoint(touch);
			return true;
		}
		if (touch.ctrlKey && touch.button === 2) { // ctrl + right click
			return this.tryUnpinningPoint(touch);
		}
		if (touch.altKey && touch.button === 0) { // alt + left click
			return this.tryStartingMovingPoint(touch);
		}
		if (touch.altKey && touch.button === 2) { // alt + right click
			return this.tryEditingPoint(touch);
		}
		return false;
	}

	addTouchUi(touch) {
		const id = touch.id;
		const touchUi = this.touches[id] = new PIXI.Graphics(this.constructor.touchGeometry);
		touchUi.touch = touch;
		const text = touchUi.text = new PIXI.Text('', {
			fontSize: Sunniesnow.Config.WIDTH / 90,
			fill: '#ff00ff',
			fontFamily: 'Noto Sans Math,Noto Sans CJK TC',
		});
		text.anchor = new PIXI.ObservablePoint(null, null, 0, 0.5);
		touchUi.addChild(text);
		text.alpha = 0.5;
		this.addChild(touchUi);
	}

	pinPoint(touch) {
		const {x, y} = touch.end();
		const pinnedPoint = this.pinPointByCoordinates(x, y);
		this.startMovingPoint(touch, pinnedPoint);
	}

	pinPointByCoordinates(x, y) {
		const pinnedPoint = new PIXI.Graphics(this.constructor.pinnedPointGeometry);
		pinnedPoint.alpha = 0.5;
		this.addChild(pinnedPoint);
		const text = new PIXI.Text('', {
			fontSize: Sunniesnow.Config.WIDTH / 90,
			fill: '#ff00ff',
			fontFamily: 'Noto Sans Math,Noto Sans CJK TC',
		});
		pinnedPoint.text = text;
		pinnedPoint.addChild(text);
		this.pinnedPoints.push(pinnedPoint);
		Sunniesnow.PinnedCoordinates.add(pinnedPoint);
		this.movePinnedPointTo(pinnedPoint, x, y);
		return pinnedPoint;
	}

	tryStartingMovingPoint(touch) {
		const point = this.findTouchedPoint(touch);
		if (point) {
			this.startMovingPoint(touch, point);
			return true;
		}
		return false;
	}

	startMovingPoint(touch, point) {
		point.movingTouch = touch;
		point.alpha = 1;
		this.movingPointsOfTouches.set(touch, point);
		Sunniesnow.PinnedCoordinates.startMoving(point);
	}

	movePinnedPointTo(point, x, y) {
		const [canvasX, canvasY] = Sunniesnow.Config.chartMapping(x, y);
		point.x = canvasX;
		point.y = canvasY;
		const text = point.text;
		text.text = `(${x.toFixed(1)},${y.toFixed(1)})`;
		if (canvasX + text.width > Sunniesnow.Config.WIDTH) {
			text.anchor.x = 1;
			text.x = -this.constructor.touchRadius;
		} else {
			text.anchor.x = 0;
			text.x = this.constructor.touchRadius;
		}
		Sunniesnow.PinnedCoordinates.update(point);
	}

	updatePinnedPoints(delta) {
		for (const point of this.pinnedPoints) {
			if (!point.movingTouch) {
				continue;
			}
			const {x, y} = point.movingTouch.end();
			this.movePinnedPointTo(point, x, y);
		}
	}

	unpinPoint(point) {
		this.removeChild(point);
		point.destroy({children: true});
		this.pinnedPoints.splice(this.pinnedPoints.indexOf(point), 1);
		Sunniesnow.PinnedCoordinates.remove(point);
	}

	tryUnpinningPoint(touch) {
		const point = this.findTouchedPoint(touch);
		if (point) {
			this.unpinPoint(point);
			return true;
		}
		return false;
	}

	findTouchedPoint(touch) {
		let nearest = null;
		let minDistance = Infinity;
		const {canvasX: x, canvasY: y} = touch.start();
		this.pinnedPoints.forEach(pinnedPoint => {
			const distance = Math.hypot(pinnedPoint.x - x, pinnedPoint.y - y);
			if (distance < minDistance) {
				minDistance = distance;
				nearest = pinnedPoint;
			}
		});
		return minDistance < this.constructor.pinnedPointRadius ? nearest : null;
	}

	updateTouches(delta) {
		for (const [id, touchUi] of Object.entries(this.touches)) {
			const {x, y, canvasX, canvasY} = touchUi.touch.end();
			touchUi.x = canvasX;
			touchUi.y = canvasY;
			touchUi.text.text = `${id}(${x.toFixed(1)},${y.toFixed(1)})`;
			if (touchUi.x + touchUi.width > Sunniesnow.Config.WIDTH) {
				touchUi.text.anchor.x = 1;
				touchUi.text.x = -this.constructor.touchRadius;
			} else {
				touchUi.text.anchor.x = 0;
				touchUi.text.x = this.constructor.touchRadius;
			}
		}
		for (const touchUi of this.endedTouches) {
			touchUi.alpha -= 0.5 * delta / this.constructor.touchUiLifeTime;
			if (touchUi.alpha <= 0) {
				touchUi.destroy({children: true});
				this.endedTouches.delete(touchUi);
				this.removeChild(touchUi);
			}
		}
	}

	touchEnd(touch) {
		this.endTouch(touch);
		if (!this.visible) {
			return false;
		}
		if (touch.altKey || touch.ctrlKey && touch.button === 0) { // alt + left click
			return this.endMovingPoint(touch);
		}
		return false;
	}

	endTouch(touch) {
		const touchUi = this.touches[touch.id];
		delete this.touches[touch.id];
		if (!touchUi) {
			return;
		}
		touchUi.alpha = 0.5;
		this.endedTouches.add(touchUi);
	}

	endMovingPoint(touch) {
		if (!this.movingPointsOfTouches.has(touch)) {
			return false;
		}
		const point = this.movingPointsOfTouches.get(touch);
		point.alpha = 0.5;
		this.movingPointsOfTouches.delete(touch);
		point.movingTouch = null;
		Sunniesnow.PinnedCoordinates.stopMoving(point);
		return true;
	}

	tryEditingPoint(touch) {
		const point = this.findTouchedPoint(touch);
		if (point) {
			Sunniesnow.PinnedCoordinates.edit(point);
			return true;
		}
		return false;
	}

	createEarlyLateText(uiNote) {
		const text = Math.round(uiNote.levelNote.hitRelativeTime * 1000).toString();
		const earlyLateText = new PIXI.Text(text, {
			fontFamily: 'Noto Sans Math,Noto Sans CJK TC',
			fontSize: Sunniesnow.Config.WIDTH / 36,
			fill: '#ff00ff',
			align: 'center'
		});
		earlyLateText.anchor = new PIXI.ObservablePoint(null, null, 0.5, 0.5);
		earlyLateText.x = uiNote.x;
		earlyLateText.y = uiNote.y;
		this.addChild(earlyLateText);
		this.earlyLateTexts.push(earlyLateText);
	}

	updateEarlyLateTexts(delta) {
		for (let i = 0; i < this.earlyLateTexts.length;) {
			const earlyLateText = this.earlyLateTexts[i];
			earlyLateText.alpha -= 0.02 * delta;
			if (earlyLateText.alpha <= 0) {
				earlyLateText.destroy();
				this.removeChild(earlyLateText);
				this.earlyLateTexts.splice(i, 1);
			} else {
				i++;
			}
		}
	}

	createTouchArea(uiNote) {
		const graphics = new PIXI.Graphics(this.constructor.touchAreaGeometry);
		graphics.x = uiNote.x;
		if (!Sunniesnow.game.settings.scroll) {
			graphics.y = uiNote.y;
		}
		graphics.uiNote = uiNote;
		this.addChild(graphics);
		this.touchAreas.push(graphics);
	}

	updateTouchAreas(delta) {
		for (let i = 0; i < this.touchAreas.length;) {
			const touchArea = this.touchAreas[i];
			const state = touchArea.uiNote.state;
			if (!touchArea.uiNote.parent || state === 'fadingOut' || state === 'finished') {
				touchArea.destroy();
				this.removeChild(touchArea);
				this.touchAreas.splice(i, 1);
			} else {
				i++;
			}
		}
	}

	addEventInfoTipHighlight(uiEvent) {
		const filter = new PIXI.ColorMatrixFilter();
		(uiEvent.filters ||= []).push(filter);
		const highlight = {uiEvent, life: 1, filter};
		this.eventInfoTipHighlights.add(highlight);
	}

	updateEventInfoTipHighlights(delta) {
		for (const highlight of this.eventInfoTipHighlights) {
			const uiEvent = highlight.uiEvent;
			highlight.life -= delta / this.constructor.eventInfoTipHighlightLifeTime;
			if (!uiEvent.parent || highlight.life <= 0) {
				uiEvent.filters.splice(uiEvent.filters.indexOf(highlight.filter), 1);
				this.eventInfoTipHighlights.delete(highlight);
				this.removeChild(uiEvent);
				continue;
			}
			Sunniesnow.Utils.colorMatrixInterpolate(
				this.constructor.mainColor, highlight.life, highlight.filter.matrix
			);
		}
	}
};
