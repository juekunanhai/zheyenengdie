System.register("chunks:///_virtual/game-audio.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './local-platform.ts'], function (exports) {
  var _createForOfIteratorHelperLoose, cclegacy, isValid, game, Game, Node, AudioSource, markUserInteraction, hasUserInteraction, readSettings;
  return {
    setters: [function (module) {
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
      isValid = module.isValid;
      game = module.game;
      Game = module.Game;
      Node = module.Node;
      AudioSource = module.AudioSource;
    }, function (module) {
      markUserInteraction = module.markUserInteraction;
      hasUserInteraction = module.hasUserInteraction;
      readSettings = module.readSettings;
    }],
    execute: function () {
      cclegacy._RF.push({}, "647ceq3ES5WFbj5d040tN2s", "game-audio", undefined);
      var CLIP_IDS = {
        impact_cardboard_box: ['impact_paper_1', 'impact_paper_2', 'impact_paper_3'],
        impact_wood_plank: ['impact_wood_1', 'impact_wood_2', 'impact_wood_3'],
        impact_basketball: ['impact_rubber_1', 'impact_rubber_2', 'impact_rubber_3'],
        impact_fridge: ['impact_metal_1', 'impact_metal_2', 'impact_metal_3'],
        impact_dumbbell: ['impact_metal_1', 'impact_metal_2', 'impact_metal_3'],
        // Trial reuses approved hard-surface sounds; dedicated ceramic audio remains pending.
        impact_toilet: ['impact_metal_1', 'impact_metal_2', 'impact_metal_3'],
        skill_rotate_90: ['rotate_90'],
        claw_release: ['claw_open'],
        ui_tap: ['next_handoff']
      };
      /** Eight interruptible sources: the agreed cap, with at most four concurrent impacts. */
      var GameAudio = exports('GameAudio', /*#__PURE__*/function () {
        function GameAudio(node, clips) {
          var _this = this;
          this.voices = [];
          this.suspended = false;
          this.hidden = false;
          this.playedAt = new Map();
          this.variants = new Map();
          this.clock = 0;
          this.hide = function () {
            _this.hidden = true;
            _this.stop();
          };
          this.show = function () {
            _this.hidden = false;
          };
          this.clips = clips;
          for (var i = 0; i < 8; i++) {
            var child = new Node("Sfx:" + i);
            node.addChild(child);
            var source = child.addComponent(AudioSource);
            source.playOnAwake = false;
            source.loop = false;
            this.voices.push({
              source: source,
              availableAt: 0,
              collision: false
            });
          }
          game.on(Game.EVENT_HIDE, this.hide);
          game.on(Game.EVENT_SHOW, this.show);
        }
        var _proto = GameAudio.prototype;
        _proto.interact = function interact() {
          markUserInteraction();
        };
        _proto.update = function update(dt) {
          if (this.suspended || this.hidden) return;
          this.clock += dt;
          for (var _iterator = _createForOfIteratorHelperLoose(this.playedAt), _step; !(_step = _iterator()).done;) {
            var _step$value = _step.value,
              key = _step$value[0],
              time = _step$value[1];
            if (this.clock - time > 1) this.playedAt["delete"](key);
          }
        };
        _proto.pause = function pause(value) {
          this.suspended = value;
          if (value) this.stop();
        };
        _proto.stop = function stop() {
          for (var _iterator2 = _createForOfIteratorHelperLoose(this.voices), _step2; !(_step2 = _iterator2()).done;) {
            var voice = _step2.value;
            if (isValid(voice.source, true)) voice.source.stop();
            voice.availableAt = 0;
          }
        };
        _proto.play = function play(name, volume, pairKey) {
          var _CLIP_IDS$name,
            _this$variants$get,
            _this$playedAt$get,
            _this2 = this,
            _this$voices$find;
          if (volume === void 0) {
            volume = .7;
          }
          if (pairKey === void 0) {
            pairKey = name;
          }
          var ids = (_CLIP_IDS$name = CLIP_IDS[name]) != null ? _CLIP_IDS$name : [name];
          var index = (_this$variants$get = this.variants.get(name)) != null ? _this$variants$get : 0;
          var clip = this.clips.get(ids[index % ids.length]);
          if (!clip || !hasUserInteraction() || this.suspended || this.hidden || !readSettings().sound) return false;
          if (this.clock - ((_this$playedAt$get = this.playedAt.get(pairKey)) != null ? _this$playedAt$get : -1) < .12) return false;
          var busy = function busy(v) {
            return v.source.playing || v.availableAt > _this2.clock;
          };
          var collision = name.startsWith('impact_');
          if (collision && this.voices.filter(function (v) {
            return v.collision && busy(v);
          }).length >= 4) return false;
          var voice = (_this$voices$find = this.voices.find(function (v) {
            return !busy(v);
          })) != null ? _this$voices$find : !collision ? this.voices.find(function (v) {
            return v.collision;
          }) : undefined;
          if (!voice) return false;
          voice.source.stop();
          voice.source.clip = clip;
          voice.source.volume = Math.max(0, Math.min(.9, volume));
          voice.availableAt = this.clock + clip.getDuration() + .1;
          voice.collision = collision;
          this.playedAt.set(pairKey, this.clock);
          this.variants.set(name, index + 1);
          voice.source.play();
          return true;
        };
        _proto.dispose = function dispose() {
          game.off(Game.EVENT_HIDE, this.hide);
          game.off(Game.EVENT_SHOW, this.show);
          this.stop();
        };
        return GameAudio;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/game-controller.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './game-audio.ts', './local-platform.ts', './object-data.ts', './play-view.ts', './tower-world.ts'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, _createForOfIteratorHelperLoose, cclegacy, _decorator, SpriteFrame, AudioClip, director, Vec2, Component, GameAudio, readSettings, RunLifecycle, TouchBinding, bindAction, writeSettings, PLANNING_SECONDS, CALIBRATION_SEQUENCE, OBJECTS, localBounds, MAX_OBSERVE_SECONDS, planarAngle, ENTER_SECONDS, STABLE_SECONDS, runResult, PlayView, TowerWorld;
  return {
    setters: [function (module) {
      _applyDecoratedDescriptor = module.applyDecoratedDescriptor;
      _inheritsLoose = module.inheritsLoose;
      _initializerDefineProperty = module.initializerDefineProperty;
      _assertThisInitialized = module.assertThisInitialized;
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      SpriteFrame = module.SpriteFrame;
      AudioClip = module.AudioClip;
      director = module.director;
      Vec2 = module.Vec2;
      Component = module.Component;
    }, function (module) {
      GameAudio = module.GameAudio;
    }, function (module) {
      readSettings = module.readSettings;
      RunLifecycle = module.RunLifecycle;
      TouchBinding = module.TouchBinding;
      bindAction = module.bindAction;
      writeSettings = module.writeSettings;
    }, function (module) {
      PLANNING_SECONDS = module.PLANNING_SECONDS;
      CALIBRATION_SEQUENCE = module.CALIBRATION_SEQUENCE;
      OBJECTS = module.OBJECTS;
      localBounds = module.localBounds;
      MAX_OBSERVE_SECONDS = module.MAX_OBSERVE_SECONDS;
      planarAngle = module.planarAngle;
      ENTER_SECONDS = module.ENTER_SECONDS;
      STABLE_SECONDS = module.STABLE_SECONDS;
      runResult = module.runResult;
    }, function (module) {
      PlayView = module.PlayView;
    }, function (module) {
      TowerWorld = module.TowerWorld;
    }],
    execute: function () {
      var _dec, _dec2, _dec3, _class, _class2, _descriptor, _descriptor2;
      cclegacy._RF.push({}, "f4da7hhfoFaErAxBAm2047A", "game-controller", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;
      var StackGameController = exports('StackGameController', (_dec = ccclass('StackGameController'), _dec2 = property([SpriteFrame]), _dec3 = property([AudioClip]), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(StackGameController, _Component);
        function StackGameController() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _initializerDefineProperty(_this, "frames", _descriptor, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "approvedSounds", _descriptor2, _assertThisInitialized(_this));
          _this.phase = 'entering';
          _this.world = void 0;
          _this.display = void 0;
          _this.lifecycle = void 0;
          _this.touches = void 0;
          _this.audio = void 0;
          _this.current = null;
          _this.boundary = {
            top: 0,
            bottom: 0,
            left: 0,
            right: 0
          };
          _this.clock = 0;
          _this.stableFor = 0;
          _this.planningLeft = PLANNING_SECONDS;
          _this.releaseCount = 0;
          _this.placedCount = 0;
          _this.peak = 0;
          _this.finger = null;
          _this.dragOffset = 0;
          _this.tutorial = false;
          _this.rotations = 0;
          _this.sequence = CALIBRATION_SEQUENCE;
          _this.untimedCalibration = false;
          return _this;
        }
        var _proto = StackGameController.prototype;
        _proto.onLoad = function onLoad() {
          var _this2 = this;
          this.world = new TowerWorld(this.node.scene, function (record, pair, speed) {
            return _this2.impact(record, pair, speed);
          });
          this.display = new PlayView(this.node, new Map(this.frames.map(function (frame) {
            return [frame.name, frame];
          })));
          this.audio = new GameAudio(this.node, new Map(this.approvedSounds.map(function (clip) {
            return [clip.name, clip];
          })));
          this.tutorial = !readSettings().tutorialDone;
          this.lifecycle = new RunLifecycle(function (paused) {
            _this2.finger = null;
            _this2.audio.pause(paused);
            _this2.display.setHint(paused ? '已暂停 · 点击暂停按钮继续' : '');
          });
          this.touches = new TouchBinding(this.display.input, {
            start: function start(id, point) {
              return _this2.touchStart(id, point);
            },
            move: function move(id, point) {
              return _this2.touchMove(id, point);
            },
            end: function end(id) {
              return _this2.touchEnd(id);
            },
            cancel: function cancel(id) {
              if (id === _this2.finger) _this2.finger = null;
            }
          });
          bindAction(this.display.rotate, function () {
            _this2.audio.interact();
            _this2.rotate();
          });
          bindAction(this.display.pause, function () {
            return _this2.lifecycle.togglePause();
          });
          // Inventory is visually preserved, but its events cannot release a held object.
          bindAction(this.display.safe.getChildByName('InventoryColumn'), function () {});
          this.spawn();
        };
        _proto.spawn = function spawn() {
          var index = this.releaseCount % this.sequence.length;
          var spec = OBJECTS[this.sequence[index]];
          this.boundary = this.display.beginPlacement(this.world.placementTop(), Math.max(spec.width, spec.height));
          this.current = this.world.create(spec, 0, this.boundary.top - localBounds(spec, 0).top + 55);
          this.display.setNext(this.sequence[(index + 1) % this.sequence.length]);
          this.audio.play('next_handoff', .35);
          this.phase = 'entering';
          this.clock = 0;
          this.planningLeft = PLANNING_SECONDS;
          this.rotations = 0;
        };
        _proto.update = function update(delta) {
          this.lifecycle.update(delta);
          if (this.lifecycle.paused || this.phase === 'ended') return;
          var dt = Math.min(delta, .067);
          this.clock += delta;
          this.audio.update(dt);
          for (var _iterator = _createForOfIteratorHelperLoose(this.world.bodies), _step; !(_step = _iterator()).done;) {
            var record = _step.value;
            if (!record.collider.enabled) continue;
            if (record.contactSeconds !== null) record.contactSeconds = Math.min(MAX_OBSERVE_SECONDS, record.contactSeconds + delta);
            var edge = record.lossBoundary;
            if (!edge) continue;
            var bounds = this.world.bounds(record);
            if (bounds.top < edge.bottom || bounds.right < edge.left || bounds.left > edge.right) {
              this.finish('calibration_drop');
              return;
            }
          }
          this.confirmStable(dt);
          if (this.phase === 'entering') this.enter();else if (this.phase === 'planning') this.plan(dt);else if (this.phase === 'falling' || this.phase === 'observing') this.observe();
        };
        _proto.lateUpdate = function lateUpdate(dt) {
          if (!this.display || this.lifecycle.paused) return;
          var held = this.phase === 'planning' || this.phase === 'entering' ? this.current : null;
          if (this.display.fit()) {
            this.boundary = this.display.beginPlacement(this.world.placementTop(), held ? Math.max(held.spec.width, held.spec.height) : 0);
            if (held && this.phase === 'planning') {
              var bounds = localBounds(held.spec, planarAngle(held.node.rotation));
              held.node.setPosition(held.node.position.x, this.boundary.top - bounds.top, 0);
              this.moveTo(held.node.position.x);
              this.finger = null;
            }
          }
          this.display.update(Math.min(dt, .067), this.world.bodies, held, Math.min(1, this.clock / .24), this.phase === 'entering');
        };
        _proto.enter = function enter() {
          var current = this.current;
          var t = Math.min(1, this.clock / ENTER_SECONDS);
          current.node.setPosition(current.node.position.x, this.boundary.top - localBounds(current.spec, 0).top + 55 * Math.pow(1 - t, 3), 0);
          if (t === 1) {
            this.phase = 'planning';
            this.clock = 0;
            this.audio.play('claw_grip');
            this.plan(0);
          }
        };
        _proto.plan = function plan(dt) {
          if (this.world.hasPlacementHazard()) {
            this.finger = null;
            this.display.setHint('等待掉落结束');
            return;
          }
          var exempt = this.untimedCalibration || this.tutorial && this.releaseCount < 2;
          if (!exempt) this.planningLeft = Math.max(0, this.planningLeft - dt);
          var text = this.untimedCalibration ? '观察 NEXT · 松手释放' : exempt ? this.releaseCount === 1 && this.rotations === 0 ? '试试右下旋转按钮，再松手释放' : '左右拖动，松手释放' : Math.ceil(this.planningLeft) + " \u79D2\u540E\u91CA\u653E";
          this.display.setHint(text);
          if (!exempt && this.planningLeft === 0) this.release();
        };
        _proto.touchStart = function touchStart(id, point) {
          this.audio.interact();
          if (this.phase !== 'planning' || this.lifecycle.paused || this.finger !== null) return;
          this.finger = id;
          this.dragOffset = this.current.node.position.x - this.display.pointerX(point);
        };
        _proto.touchMove = function touchMove(id, point) {
          if (id !== this.finger || this.phase !== 'planning' || this.lifecycle.paused) return;
          this.moveTo(this.display.pointerX(point) + this.dragOffset);
        };
        _proto.touchEnd = function touchEnd(id) {
          if (id !== this.finger) return;
          this.finger = null;
          this.release();
        };
        _proto.moveTo = function moveTo(x) {
          if (this.phase !== 'planning' || !this.current || this.lifecycle.paused) return;
          var bounds = localBounds(this.current.spec, planarAngle(this.current.node.rotation));
          var clamped = Math.max(this.boundary.left - bounds.left + 4, Math.min(this.boundary.right - bounds.right - 4, x));
          this.current.node.setPosition(clamped, this.current.node.position.y, 0);
        };
        _proto.rotate = function rotate() {
          if (this.phase !== 'planning' || !this.current || this.lifecycle.paused) return;
          var current = this.current;
          this.rotations++;
          current.node.setRotationFromEuler(0, 0, -(this.rotations % 4) * 90);
          var bounds = localBounds(current.spec, -(this.rotations % 4) * 90);
          current.node.setPosition(current.node.position.x, this.boundary.top - bounds.top, 0);
          this.moveTo(current.node.position.x);
          this.audio.play('skill_rotate_90');
        };
        _proto.release = function release() {
          if (this.phase !== 'planning' || !this.current || this.lifecycle.paused || this.world.hasPlacementHazard()) return;
          this.phase = 'falling';
          this.clock = 0;
          this.finger = null;
          this.stableFor = 0;
          this.current.lossBoundary = {
            left: this.boundary.left,
            right: this.boundary.right,
            bottom: this.boundary.bottom
          };
          this.world.release(this.current);
          this.releaseCount++;
          this.display.setHint('');
          this.audio.play('claw_release');
        }

        /** Local experiment host may select a sequence before the first release.
         * No mid-run NEXT replacement, persistent setting, or production director. */;
        _proto.configureCalibration = function configureCalibration(sequence, untimed) {
          var _this3 = this;
          if (untimed === void 0) {
            untimed = false;
          }
          if (this.releaseCount !== 0 || !this.current || this.phase === 'ended' || sequence.length < 2 || sequence[0] !== this.current.spec.kind || sequence.some(function (kind) {
            return !OBJECTS[kind] || !_this3.frames.some(function (frame) {
              return frame.name === "object_" + kind;
            }) || !_this3.frames.some(function (frame) {
              return frame.name === "next_" + kind;
            });
          })) return false;
          this.sequence = [].concat(sequence);
          this.untimedCalibration = untimed;
          this.display.setNext(this.sequence[1]);
          return true;
        };
        _proto.observe = function observe() {
          var current = this.current;
          if (current.contactSeconds !== null && this.phase === 'falling') {
            this.phase = 'observing';
          }
          if (this.phase !== 'observing' || this.world.hasPlacementHazard()) return;
          if (!current.placed && current.contactSeconds < MAX_OBSERVE_SECONDS) return;
          // Handoff does not mark an unsettled piece as placed or award its height.
          // The first-run exemption concerns the first two releases, even if settling is delayed.
          if (this.tutorial && this.releaseCount >= 2) {
            var settings = readSettings();
            settings.tutorialDone = true;
            writeSettings(settings);
          }
          this.spawn();
        };
        _proto.confirmStable = function confirmStable(dt) {
          this.stableFor = this.world.isStable() ? this.stableFor + dt : 0;
          if (this.stableFor < STABLE_SECONDS) return;
          var confirmed = 0;
          for (var _iterator2 = _createForOfIteratorHelperLoose(this.world.bodies), _step2; !(_step2 = _iterator2()).done;) {
            var record = _step2.value;
            if (!record.collider.enabled || record.placed) continue;
            record.placed = true;
            confirmed++;
          }
          if (!confirmed) return;
          this.placedCount += confirmed;
          this.peak = Math.max(this.peak, this.world.confirmedTop());
          this.display.setHeight(this.peak);
          // Camera room is selected at handoff, independently of delayed score confirmation.
          // The approved stable cue is reserved for qualified highlights in Batch 2.
        }

        /** Internal 1A end/retry path; the official incident failure rules belong to 1B. */;
        _proto.finish = function finish(reason) {
          if (reason === void 0) {
            reason = 'calibration_end';
          }
          if (this.phase === 'ended') return;
          this.phase = 'ended';
          this.clock = 0;
          this.finger = null;
          runResult.height = this.peak / 100;
          runResult.placed = this.placedCount;
          runResult.reason = reason;
          var settings = readSettings();
          settings.tutorialDone = true;
          writeSettings(settings);
          this.audio.pause(true);
          director.loadScene('Result');
        };
        _proto.impact = function impact(record, pair, speed) {
          if (speed < .6 || this.phase === 'ended') return;
          var bounds = this.world.bounds(record);
          if (bounds.top < this.boundary.bottom || bounds.right < this.boundary.left || bounds.left > this.boundary.right) return;
          this.audio.play("impact_" + record.spec.kind, Math.min(.85, .25 + speed * .035), pair);
        }

        /** Read-only diagnostics used by the local calibration page. */;
        _proto.snapshot = function snapshot() {
          var _this$current,
            _this$current2,
            _this4 = this;
          return {
            phase: this.phase,
            releases: this.releaseCount,
            placed: this.placedCount,
            peakMetres: this.peak / 100,
            sequence: [].concat(this.sequence),
            untimedCalibration: this.untimedCalibration,
            observationSeconds: (_this$current = this.current) == null ? void 0 : _this$current.contactSeconds,
            maxObserveSeconds: MAX_OBSERVE_SECONDS,
            placementBlocked: this.world.hasPlacementHazard(),
            placementTop: this.world.placementTop(),
            secondsLeft: this.planningLeft,
            tutorial: this.tutorial,
            paused: this.lifecycle.paused,
            boundary: this.boundary,
            view: this.display.snapshot(),
            audioClips: this.approvedSounds.length,
            currentId: (_this$current2 = this.current) == null ? void 0 : _this$current2.id,
            bodies: this.world.bodies.map(function (r) {
              return {
                id: r.id,
                kind: r.spec.kind,
                position: r.node.position.clone(),
                angle: planarAngle(r.node.rotation),
                size: [r.spec.width, r.spec.height],
                physicsAxis: r.body.getWorldVector(new Vec2(1, 0), new Vec2()),
                velocity: r.body.linearVelocity.clone(),
                angularVelocity: r.body.angularVelocity,
                mass: r.body.getMass(),
                awake: r.body.isAwake(),
                contacts: r.contacts.size,
                contactSeconds: r.contactSeconds,
                lossBoundary: r.lossBoundary,
                placed: r.placed,
                type: r.body.type,
                scale: r.node.worldScale.clone(),
                bounds: _this4.world.bounds(r)
              };
            })
          };
        };
        _proto.onDestroy = function onDestroy() {
          var _this$audio, _this$touches, _this$lifecycle, _this$world, _this$display;
          (_this$audio = this.audio) == null || _this$audio.dispose();
          (_this$touches = this.touches) == null || _this$touches.dispose();
          (_this$lifecycle = this.lifecycle) == null || _this$lifecycle.dispose();
          (_this$world = this.world) == null || _this$world.dispose();
          (_this$display = this.display) == null || _this$display.dispose();
        };
        return StackGameController;
      }(Component), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "frames", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return [];
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "approvedSounds", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return [];
        }
      })), _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/HeightBackdrop.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _inheritsLoose, _createForOfIteratorHelperLoose, cclegacy, _decorator, Sprite, Rect, Size, Vec2, Node, UITransform, UIOpacity, Component;
  return {
    setters: [function (module) {
      _inheritsLoose = module.inheritsLoose;
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      Sprite = module.Sprite;
      Rect = module.Rect;
      Size = module.Size;
      Vec2 = module.Vec2;
      Node = module.Node;
      UITransform = module.UITransform;
      UIOpacity = module.UIOpacity;
      Component = module.Component;
    }],
    execute: function () {
      exports('backdropOpacity', backdropOpacity);
      var _dec, _class;
      cclegacy._RF.push({}, "fa1e0x5LFxRfZnAjwZR1Ute", "HeightBackdrop", undefined);
      var ccclass = _decorator.ccclass;

      /** Visual tuning only. Input is camera/view height above the ground, never score. */
      var BACKDROP_TRANSITIONS = exports('BACKDROP_TRANSITIONS', [[3, 12], [40, 70], [130, 190]]);
      function backdropOpacity(height, start, end) {
        var t = Math.min(1, Math.max(0, (height - start) / (end - start)));
        return t * t * (3 - 2 * t);
      }

      /** Batch 0 presentation component; no input, physics, score or tower state. */
      var HeightBackdrop = exports('HeightBackdrop', (_dec = ccclass('HeightBackdrop'), _dec(_class = /*#__PURE__*/function (_Component) {
        _inheritsLoose(HeightBackdrop, _Component);
        function HeightBackdrop() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _this.targetHeight = 0;
          _this.shownHeight = 0;
          _this.layers = [];
          _this.skyEdges = [];
          _this.edgeFrames = [];
          _this.pixelsPerMetre = 175;
          _this.lastWidth = 0;
          _this.lastHeight = 0;
          return _this;
        }
        var _proto = HeightBackdrop.prototype;
        _proto.onLoad = function onLoad() {
          var _this2 = this;
          this.layers = ['bg_ground_city', 'bg_city_altitude', 'bg_cloud_altitude', 'bg_space_altitude'].map(function (name) {
            return _this2.node.getChildByName(name);
          });
          this.skyEdges = this.layers.map(function (layer) {
            return _this2.createSkyEdge(layer);
          });
          this.fit();
          this.paint();
        }

        /** Call from the camera presenter in Batch 1; QA supplies an explicit sample now. */;
        _proto.setViewHeight = function setViewHeight(heightM, immediate, pixelsPerMetre) {
          if (immediate === void 0) {
            immediate = false;
          }
          if (pixelsPerMetre === void 0) {
            pixelsPerMetre = 175;
          }
          this.pixelsPerMetre = pixelsPerMetre;
          this.targetHeight = Number.isFinite(heightM) ? Math.max(0, heightM) : 0;
          if (immediate) {
            this.shownHeight = this.targetHeight;
            this.paint();
          }
        };
        _proto.getViewHeight = function getViewHeight() {
          return this.shownHeight;
        }

        /** Mirror a sky strip at the top edge; one stretched row produces visible vertical bands. */;
        _proto.createSkyEdge = function createSkyEdge(layer) {
          var source = layer.getComponent(Sprite).spriteFrame;
          var frame = source.clone();
          var stripHeight = Math.min(96, source.rect.height);
          frame.rect = new Rect(source.rect.x, source.rect.y, source.rect.width, stripHeight);
          frame.originalSize = new Size(source.rect.width, stripHeight);
          frame.offset = new Vec2();
          frame.flipUVY = true;
          frame.packable = false;
          this.edgeFrames.push(frame);
          var edge = new Node(layer.name + ":sky");
          edge.layer = layer.layer;
          this.node.addChild(edge);
          edge.setSiblingIndex(layer.getSiblingIndex() + 1);
          edge.addComponent(UITransform);
          var sprite = edge.addComponent(Sprite);
          sprite.spriteFrame = frame;
          sprite.sizeMode = Sprite.SizeMode.CUSTOM;
          sprite.trim = false;
          edge.addComponent(UIOpacity);
          return edge;
        };
        _proto.onDestroy = function onDestroy() {
          for (var _iterator = _createForOfIteratorHelperLoose(this.edgeFrames), _step; !(_step = _iterator()).done;) {
            var frame = _step.value;
            frame.destroy();
          }
        };
        _proto.update = function update(dt) {
          this.fit();
          if (Math.abs(this.shownHeight - this.targetHeight) < .001) return;
          this.shownHeight += (this.targetHeight - this.shownHeight) * (1 - Math.exp(-6 * dt));
          if (Math.abs(this.shownHeight - this.targetHeight) < .001) this.shownHeight = this.targetHeight;
          this.paint();
        };
        _proto.fit = function fit() {
          var size = this.node.getComponent(UITransform).contentSize;
          if (size.width === this.lastWidth && size.height === this.lastHeight) return;
          this.lastWidth = size.width;
          this.lastHeight = size.height;
          var safe = this.node.getChildByName('SafeArea');
          var content = safe == null ? void 0 : safe.getChildByName('Content_1230');
          if (content) {
            var safeHeight = safe.getComponent(UITransform).height;
            var scale = Math.min(1, safeHeight / 1230);
            content.setScale(scale, scale, 1);
          }
          var world = safe == null ? void 0 : safe.getChildByName('World_1x');
          if (world) {
            var _world$getChildByName;
            var _safeHeight = safe.getComponent(UITransform).height;
            // Keep a fixed world composition; fit short screens without moving HUD.
            // Anchor the fit at ground contact rather than the middle of the screen.
            var _scale = Math.min(1, Math.max(.6, (_safeHeight - 240) / 1094));
            world.setScale(_scale, _scale, 1);
            world.setPosition(0, -_safeHeight / 2 + 196 - _scale * (-667 + 196), 0);
            // Short claw enters at the safe-area top, independent of ground fitting.
            (_world$getChildByName = world.getChildByName('Rig')) == null || _world$getChildByName.setPosition(0, (_safeHeight / 2 - world.position.y) / _scale - 667, 0);
          }
          for (var _iterator2 = _createForOfIteratorHelperLoose(this.layers), _step2; !(_step2 = _iterator2()).done;) {
            var layer = _step2.value;
            var frame = layer.getComponent(Sprite).spriteFrame;
            var ratio = frame.originalSize.width / frame.originalSize.height;
            var height = Math.max(size.height, size.width / ratio);
            layer.getComponent(UITransform).setContentSize(height * ratio, height);
            // Bottom alignment retains the ground contact surface on short screens.
            layer.setPosition(0, (height - size.height) / 2, 0);
          }
          this.paint();
        };
        _proto.paint = function paint() {
          var _this3 = this;
          var alphas = [1].concat(BACKDROP_TRANSITIONS.map(function (_ref) {
            var start = _ref[0],
              end = _ref[1];
            return backdropOpacity(_this3.shownHeight, start, end);
          }));
          var base = 0;
          alphas.forEach(function (alpha, i) {
            if (alpha === 1) base = i;
          });
          this.layers.forEach(function (layer, i) {
            // Non-overlapping transitions need at most two full-screen draw layers.
            layer.active = i === base || i > base && alphas[i] > 0;
            layer.getComponent(UIOpacity).opacity = Math.round(alphas[i] * 255);
            // Near ground shares the tower's displacement. Distant scenery moves more slowly.
            var start = [0, 0, 40, 130][i],
              parallax = [1, .16, .025, .008][i];
            var travel = Math.max(0, _this3.shownHeight - start) * _this3.pixelsPerMetre * parallax;
            var size = layer.getComponent(UITransform);
            layer.setPosition(0, (size.height - _this3.lastHeight) / 2 - travel, 0);
            var gap = Math.max(0, _this3.lastHeight - size.height + travel);
            var edge = _this3.skyEdges[i];
            edge.active = layer.active && gap > 0;
            edge.getComponent(UIOpacity).opacity = Math.round(alphas[i] * 255);
            var visibleGap = Math.min(_this3.lastHeight, gap);
            edge.getComponent(UITransform).setContentSize(size.width, visibleGap + 1);
            edge.setPosition(0, _this3.lastHeight / 2 - visibleGap / 2, 0);
          });
        };
        return HeightBackdrop;
      }(Component)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/HomePresentation.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _inheritsLoose, _createForOfIteratorHelperLoose, cclegacy, _decorator, game, Game, Tween, tween, Vec3, UITransform, Sprite, Node, Component;
  return {
    setters: [function (module) {
      _inheritsLoose = module.inheritsLoose;
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      game = module.game;
      Game = module.Game;
      Tween = module.Tween;
      tween = module.tween;
      Vec3 = module.Vec3;
      UITransform = module.UITransform;
      Sprite = module.Sprite;
      Node = module.Node;
      Component = module.Component;
    }],
    execute: function () {
      var _dec, _class;
      cclegacy._RF.push({}, "9e6bcqTByhbOYGDUdHYtcTR", "HomePresentation", undefined);
      var ccclass = _decorator.ccclass;

      /** Approved R10.1 homepage illustration. No gameplay objects or camera-height state. */
      var HomePresentation = exports('HomePresentation', (_dec = ccclass('HomePresentation'), _dec(_class = /*#__PURE__*/function (_Component) {
        _inheritsLoose(HomePresentation, _Component);
        function HomePresentation() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _this.content = void 0;
          _this.safe = void 0;
          _this.backdrop = void 0;
          _this.clouds = [];
          _this.buttons = [];
          _this.width = 0;
          _this.height = 0;
          _this.safeTop = 0;
          _this.safeBottom = 0;
          _this.elapsed = 0;
          _this.hidden = false;
          _this.hide = function () {
            _this.hidden = true;
            _this.resetButtons();
          };
          _this.show = function () {
            _this.hidden = false;
          };
          return _this;
        }
        var _proto = HomePresentation.prototype;
        _proto.onLoad = function onLoad() {
          var _this2 = this;
          this.safe = this.node.getChildByName('SafeArea');
          // Keep the existing path used by StackSceneActions.
          this.content = this.safe.getChildByName('Content_1230');
          this.backdrop = this.node.getChildByName('HomeBackdrop');
          this.clouds = [0, 1, 2].map(function (i) {
            return _this2.content.getChildByName("R9Cloud" + i);
          });
          this.buttons = ['btn_start', 'btn_settings_icon'].map(function (name) {
            return _this2.content.getChildByName(name);
          });
          var _loop = function _loop() {
            var button = _step.value;
            button.on(Node.EventType.TOUCH_START, function () {
              return _this2.press(button, .96);
            });
            button.on(Node.EventType.TOUCH_END, function () {
              return _this2.press(button, 1);
            });
            button.on(Node.EventType.TOUCH_CANCEL, function () {
              return _this2.press(button, 1);
            });
          };
          for (var _iterator = _createForOfIteratorHelperLoose(this.buttons), _step; !(_step = _iterator()).done;) {
            _loop();
          }
          this.fit();
        };
        _proto.onEnable = function onEnable() {
          game.on(Game.EVENT_HIDE, this.hide);
          game.on(Game.EVENT_SHOW, this.show);
        };
        _proto.onDisable = function onDisable() {
          game.off(Game.EVENT_HIDE, this.hide);
          game.off(Game.EVENT_SHOW, this.show);
          this.resetButtons();
        };
        _proto.update = function update(dt) {
          this.fit();
          if (!this.hidden) this.elapsed += Math.min(dt, .05);
          this.paintClouds();
        };
        _proto.press = function press(button, scale) {
          Tween.stopAllByTarget(button);
          tween(button).to(.12, {
            scale: new Vec3(scale, scale, 1)
          }, {
            easing: 'quadOut'
          }).start();
        };
        _proto.resetButtons = function resetButtons() {
          for (var _iterator2 = _createForOfIteratorHelperLoose(this.buttons), _step2; !(_step2 = _iterator2()).done;) {
            var button = _step2.value;
            Tween.stopAllByTarget(button);
            button.setScale(1, 1, 1);
          }
        };
        _proto.fit = function fit() {
          var canvas = this.node.getComponent(UITransform);
          var safe = this.safe.getComponent(UITransform);
          var top = canvas.height / 2 - this.safe.position.y - safe.height / 2;
          var bottom = canvas.height / 2 + this.safe.position.y - safe.height / 2;
          if (canvas.width === this.width && canvas.height === this.height && top === this.safeTop && bottom === this.safeBottom) return;
          this.width = canvas.width;
          this.height = canvas.height;
          this.safeTop = top;
          this.safeBottom = bottom;
          // Fit the whole approved composition on wider screens while the backdrop still covers.
          var scale = Math.min(canvas.width / 750, canvas.height / 1334);
          var height = canvas.height / scale;
          var extra = height - 1334;
          this.content.getComponent(UITransform).setContentSize(750, height);
          this.content.setScale(scale, scale, 1);
          this.content.setPosition(-this.safe.position.x, -this.safe.position.y, 0);
          var source = this.backdrop.getComponent(Sprite).spriteFrame.originalSize;
          var cover = Math.max(canvas.width / source.width, canvas.height / source.height);
          this.backdrop.getComponent(UITransform).setContentSize(source.width * cover, source.height * cover);
          this.backdrop.setPosition(0, (source.height * cover - canvas.height) / 2, 0);
          var heroWidth = 470 + extra * .35;
          var heroLeft = 185 - (heroWidth - 470) / 2;
          var heroTop = height - 145 - heroWidth * 1507 / 1024;
          var shoeLeft = heroLeft + heroWidth * 450 / 1024 - 129;
          this.place('R9Hero', heroLeft, heroTop, heroWidth, heroWidth * 1536 / 1024);
          this.place('R9SlipperBack', shoeLeft - 45, heroTop - 136, 144, 144 * 257 / 340);
          this.place('R9SlipperFront', shoeLeft, heroTop - 121, 194, 194 * 257 / 340);
          this.place('R9WoodBoard', 22, height * .49, 226, 310);
          // The ribbon is part of the approved logo image, so it scales with the title.
          var logoWidth = 560 + extra * .2;
          var logoHeight = logoWidth * 732 / 1381;
          var logoTop = heroTop - 136 - logoHeight - 12;
          this.place('logo_main', (750 - logoWidth) / 2, logoTop, logoWidth, logoHeight);
          this.place('HomeAirship', 9, logoTop + 102, 112, 112 * 96 / 168);
          this.place('HomeAirplane', 645, logoTop + 296, 99, 99 * 94 / 159);
          // Only controls move inward for a notch/home indicator; art still fills the screen.
          this.place('btn_settings_icon', 657, Math.max(25, top / scale + 25), 67, 67);
          var buttonHeight = 556 * 210 / 594;
          this.place('btn_start', 97, Math.min(height - 203, height - bottom / scale - buttonHeight - 6), 556, buttonHeight);
          this.paintClouds();
        }

        /** The approved HTML uses a top-left, 750-wide coordinate system. */;
        _proto.place = function place(name, left, top, width, height) {
          var node = this.content.getChildByName(name);
          var contentHeight = this.content.getComponent(UITransform).height;
          node.getComponent(UITransform).setContentSize(width, height);
          node.setPosition(left + width / 2 - 375, contentHeight / 2 - top - height / 2, 0);
        };
        _proto.paintClouds = function paintClouds() {
          var _this3 = this;
          var height = this.content.getComponent(UITransform).height;
          var extra = height - 1334;
          var positions = [[-170, 300 + extra * .12, 340, 25, 7, 140, 7], [610, 490 + extra * .2, 290, 28, 13, -140, -8], [-105, 732 + extra * .25, 185, 27, 17, 110, 6]];
          this.clouds.forEach(function (cloud, i) {
            var _positions$i = positions[i],
              x = _positions$i[0],
              y = _positions$i[1],
              width = _positions$i[2],
              duration = _positions$i[3],
              offset = _positions$i[4],
              travel = _positions$i[5],
              lift = _positions$i[6];
            var phase = (_this3.elapsed + offset) / duration;
            var weight = (1 - Math.cos(Math.PI * phase)) / 2;
            var source = cloud.getComponent(Sprite).spriteFrame.originalSize;
            _this3.place(cloud.name, x + travel * weight, y + lift * weight, width, width * source.height / source.width);
          });
        };
        return HomePresentation;
      }(Component)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/local-platform.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _extends, _createClass, cclegacy, sys, isValid, Node, PhysicsSystem2D, game, Game, director, Director, view;
  return {
    setters: [function (module) {
      _extends = module.extends;
      _createClass = module.createClass;
    }, function (module) {
      cclegacy = module.cclegacy;
      sys = module.sys;
      isValid = module.isValid;
      Node = module.Node;
      PhysicsSystem2D = module.PhysicsSystem2D;
      game = module.game;
      Game = module.Game;
      director = module.director;
      Director = module.Director;
      view = module.view;
    }],
    execute: function () {
      exports({
        bindAction: bindAction,
        hasUserInteraction: hasUserInteraction,
        markUserInteraction: markUserInteraction,
        readSettings: readSettings,
        writeSettings: writeSettings
      });
      cclegacy._RF.push({}, "5d250luacFVF6lNBTH5eZJx", "local-platform", undefined);
      var STORAGE_KEY = 'zhynd.local-settings.v1';
      var defaults = {
        tutorialDone: false,
        music: true,
        sound: true,
        vibration: false
      };
      var userHasInteracted = false;
      function markUserInteraction() {
        userHasInteracted = true;
      }
      function hasUserInteraction() {
        return userHasInteracted;
      }

      /** The current engine-backed storage boundary; no unused platform SDK shells. */
      function readSettings() {
        try {
          var saved = JSON.parse(sys.localStorage.getItem(STORAGE_KEY) || '{}');
          var result = _extends({}, defaults);
          for (var _i = 0, _arr = Object.keys(result); _i < _arr.length; _i++) {
            var key = _arr[_i];
            if (typeof (saved == null ? void 0 : saved[key]) === 'boolean') result[key] = saved[key];
          }
          return result;
        } catch (_unused) {
          return _extends({}, defaults);
        }
      }
      function writeSettings(value) {
        try {
          sys.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
          return true;
        } catch (_unused2) {
          return false;
        }
      }
      /** Engine touch coordinates are the only input that reaches gameplay. */
      var TouchBinding = exports('TouchBinding', /*#__PURE__*/function () {
        function TouchBinding(node, sink) {
          var _this = this;
          this.start = function (e) {
            e.propagationStopped = true;
            markUserInteraction();
            var id = e.getID();
            if (id !== null) _this.sink.start(id, e.getUILocation());
          };
          this.move = function (e) {
            e.propagationStopped = true;
            var id = e.getID();
            if (id !== null) _this.sink.move(id, e.getUILocation());
          };
          this.end = function (e) {
            e.propagationStopped = true;
            var id = e.getID();
            if (id !== null) _this.sink.end(id);
          };
          this.cancel = function (e) {
            e.propagationStopped = true;
            var id = e.getID();
            if (id !== null) _this.sink.cancel(id);
          };
          this.node = node;
          this.sink = sink;
          node.on(Node.EventType.TOUCH_START, this.start);
          node.on(Node.EventType.TOUCH_MOVE, this.move);
          node.on(Node.EventType.TOUCH_END, this.end);
          node.on(Node.EventType.TOUCH_CANCEL, this.cancel);
        }
        var _proto = TouchBinding.prototype;
        _proto.dispose = function dispose() {
          if (!isValid(this.node, true)) return;
          this.node.off(Node.EventType.TOUCH_START, this.start);
          this.node.off(Node.EventType.TOUCH_MOVE, this.move);
          this.node.off(Node.EventType.TOUCH_END, this.end);
          this.node.off(Node.EventType.TOUCH_CANCEL, this.cancel);
        };
        return TouchBinding;
      }());
      function bindAction(node, action) {
        var finger = null;
        node.on(Node.EventType.TOUCH_START, function (e) {
          e.propagationStopped = true;
          if (finger === null) finger = e.getID();
        });
        node.on(Node.EventType.TOUCH_MOVE, function (e) {
          e.propagationStopped = true;
        });
        node.on(Node.EventType.TOUCH_CANCEL, function (e) {
          e.propagationStopped = true;
          if (finger === e.getID()) finger = null;
        });
        node.on(Node.EventType.TOUCH_END, function (e) {
          e.propagationStopped = true;
          if (finger === null || finger !== e.getID()) return;
          finger = null;
          markUserInteraction();
          action();
        });
      }

      /** User pause and app visibility can overlap; returning to the app must not undo user pause. */
      var RunLifecycle = exports('RunLifecycle', /*#__PURE__*/function () {
        function RunLifecycle(changed) {
          var _this2 = this;
          this.hidden = false;
          this.userPaused = false;
          this.frameTime = 0;
          this.hide = function () {
            _this2.hidden = true;
            _this2.apply();
          };
          this.show = function () {
            _this2.hidden = false;
            _this2.apply();
          };
          this.afterPhysics = function () {
            var physics = PhysicsSystem2D.instance;
            if (_this2.frameTime > physics.fixedTimeStep * physics.maxSubSteps) physics.resetAccumulator();
          };
          this.changed = changed;
          game.on(Game.EVENT_HIDE, this.hide);
          game.on(Game.EVENT_SHOW, this.show);
          director.on(Director.EVENT_AFTER_PHYSICS, this.afterPhysics);
          view.resizeWithBrowserSize(true);
        }
        var _proto2 = RunLifecycle.prototype;
        _proto2.update = function update(dt) {
          this.frameTime = dt;
        };
        _proto2.togglePause = function togglePause() {
          this.userPaused = !this.userPaused;
          this.apply();
        };
        _proto2.apply = function apply() {
          this.changed(this.paused);
          PhysicsSystem2D.instance.resetAccumulator();
          if (this.paused) game.pause();else game.resume();
        };
        _proto2.dispose = function dispose() {
          game.off(Game.EVENT_HIDE, this.hide);
          game.off(Game.EVENT_SHOW, this.show);
          director.off(Director.EVENT_AFTER_PHYSICS, this.afterPhysics);
          if (this.paused) game.resume();
        };
        _createClass(RunLifecycle, [{
          key: "paused",
          get: function get() {
            return this.hidden || this.userPaused;
          }
        }]);
        return RunLifecycle;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/main", ['./HeightBackdrop.ts', './HomePresentation.ts', './game-audio.ts', './game-controller.ts', './local-platform.ts', './object-data.ts', './play-view.ts', './scene-actions.ts', './tower-world.ts'], function () {
  return {
    setters: [null, null, null, null, null, null, null, null, null],
    execute: function () {}
  };
});

System.register("chunks:///_virtual/object-data.ts", ['cc'], function (exports) {
  var cclegacy;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      exports({
        halfExtents: halfExtents,
        localBounds: localBounds,
        planarAngle: planarAngle
      });
      cclegacy._RF.push({}, "fce5fjSMR5R0ZEMlFQquvyn", "object-data", undefined);
      /** Four-object baseline: official scale, sha256 8c4306d7…851846.
       * Toilet/dumbbell are shape-trial-1 candidates; source scale stays unchanged.
       * Materials remain calibration values, not final balance. */
      var UNITS_PER_METRE = exports('UNITS_PER_METRE', 100);
      var PLATFORM_WIDTH = exports('PLATFORM_WIDTH', 160);
      var PLANNING_SECONDS = exports('PLANNING_SECONDS', 4);
      var ENTER_SECONDS = exports('ENTER_SECONDS', .24);
      var STABLE_SECONDS = exports('STABLE_SECONDS', .65);
      var MAX_OBSERVE_SECONDS = exports('MAX_OBSERVE_SECONDS', 1.5);
      var OBJECTS = exports('OBJECTS', {
        cardboard_box: {
          kind: 'cardboard_box',
          width: 100,
          height: 100,
          circle: false,
          spriteWidth: 123.4306,
          spriteHeight: 122.6050,
          outline: [[-50, -34], [-18, -50], [17, -50], [50, -29], [50, 39], [25, 50], [-20, 50], [-50, 32]],
          friction: .65,
          restitution: .02,
          density: .5
        },
        wood_plank: {
          kind: 'wood_plank',
          width: 195,
          height: 28,
          circle: false,
          spriteWidth: 206.7773,
          spriteHeight: 54.6483,
          spriteOffset: [0, 7.85],
          outline: [[-83.5, -14], [83.5, -14], [97.5, 5], [87, 14], [-87, 14], [-97.5, 5]],
          friction: .65,
          restitution: .02,
          density: .7
        },
        basketball: {
          kind: 'basketball',
          width: 68,
          height: 68,
          circle: true,
          spriteWidth: 70.2295,
          spriteHeight: 70.2295,
          friction: .85,
          restitution: .03,
          density: .4,
          contactAngularDamping: 6,
          adhesion: {
            maxForce: 1500,
            maxTorque: 150,
            maxImpactSpeed: 2
          },
          description: '别担心，有人给它贴了双面胶。'
        },
        fridge: {
          kind: 'fridge',
          width: 82,
          height: 145,
          circle: false,
          spriteWidth: 121.9219,
          spriteHeight: 170.2030,
          spriteOffset: [10, 0],
          outline: [[-41, -49], [-12, -72.5], [7, -72.5], [41, -55], [41, 67], [26, 72.5], [-12, 72.5], [-41, 56]],
          friction: .6,
          restitution: .01,
          density: 1.2
        },
        // R2: visible broad foot and center-spanning tank; preserve the R1 total mass.
        toilet: {
          kind: 'toilet',
          width: 150.900515,
          height: 115,
          circle: false,
          spriteWidth: 154.64837,
          spriteHeight: 118.5506,
          spriteOffset: [0.098628, 0.0],
          outline: [[-74.266724, 54.738422], [-75.450257, 51.582333], [-74.858491, 46.848199], [-72.096913, 44.875643], [-70.518868, 18.837907], [-67.165523, -1.084906], [-63.417667, -7.791595], [-57.697256, -9.764151], [-52.174099, -16.668096], [-48.031732, -22.191252], [-46.256432, -28.897942], [-47.637221, -34.421098], [-50.596055, -40.141509], [-56.119211, -44.678388], [-63.023156, -47.834477], [-66.573756, -51.187822], [-67.75729, -55.921955], [-64.601201, -57.5], [64.009434, -57.5], [67.362779, -54.541166], [65.192967, -49.01801], [59.078045, -45.46741], [56.316467, -41.127787], [54.738422, -35.21012], [56.513722, -32.054031], [63.417667, -28.503431], [68.546312, -24.163808], [72.294168, -17.654374], [74.463979, -9.566895], [75.450257, -1.282161], [73.280446, 2.465695], [67.560034, 4.43825], [24.95283, 4.43825], [22.585763, 4.240995], [24.95283, 45.861921], [27.517153, 47.24271], [28.108919, 51.779588], [26.925386, 55.330189], [21.993997, 57.5], [-68.940823, 57.5]],
          friction: 0.62,
          restitution: 0.015,
          density: 0.401990728786
        },
        // shape-trial-1 dumbbell retains its original candidate data.
        dumbbell: {
          kind: 'dumbbell',
          width: 147.939914,
          height: 45,
          circle: false,
          spriteWidth: 151.416309,
          spriteHeight: 48.476395,
          spriteOffset: [0, 0],
          outline: [[-67.982833, 17.285408], [-70.493562, 11.491416], [-73.969957, 9.560086], [-73.969957, -9.946352], [-70.493562, -11.684549], [-67.982833, -17.478541], [-62.76824, -22.5], [-35.729614, -22.5], [-31.287554, -18.05794], [-28.969957, -11.298283], [-26.652361, -8.401288], [-22.982833, -7.049356], [22.7897, -7.049356], [26.652361, -8.401288], [28.390558, -11.298283], [30.515021, -17.478541], [35.729614, -22.5], [62.961373, -22.5], [68.175966, -17.478541], [70.493562, -12.070815], [73.969957, -9.946352], [73.969957, 9.560086], [70.493562, 11.298283], [67.7897, 17.285408], [62.961373, 22.5], [35.729614, 22.5], [30.901288, 17.671674], [28.583691, 12.070815], [26.652361, 8.787554], [22.7897, 7.049356], [-22.982833, 7.049356], [-25.686695, 8.208155], [-28.583691, 11.10515], [-30.321888, 17.092275], [-35.729614, 22.5], [-62.76824, 22.5]],
          friction: 0.72,
          restitution: 0.015,
          density: 1.1
        }
      });
      // An explicit calibration sequence; the risk director is a later batch.
      var CALIBRATION_SEQUENCE = exports('CALIBRATION_SEQUENCE', ['cardboard_box', 'wood_plank', 'fridge', 'basketball']);
      function halfExtents(spec, angle) {
        if (spec.circle) return {
          x: spec.width / 2,
          y: spec.height / 2
        };
        var a = angle * Math.PI / 180;
        var c = Math.abs(Math.cos(a)),
          s = Math.abs(Math.sin(a));
        return {
          x: (spec.width * c + spec.height * s) / 2,
          y: (spec.width * s + spec.height * c) / 2
        };
      }

      /** Actual rotated support outline; the rectangle remains only the nominal size envelope. */
      function localBounds(spec, angle) {
        if (!spec.outline) {
          var half = halfExtents(spec, angle);
          return {
            left: -half.x,
            right: half.x,
            bottom: -half.y,
            top: half.y
          };
        }
        var a = angle * Math.PI / 180,
          c = Math.cos(a),
          s = Math.sin(a);
        var xs = spec.outline.map(function (_ref) {
          var x = _ref[0],
            y = _ref[1];
          return x * c - y * s;
        });
        var ys = spec.outline.map(function (_ref2) {
          var x = _ref2[0],
            y = _ref2[1];
          return x * s + y * c;
        });
        return {
          left: Math.min.apply(Math, xs),
          right: Math.max.apply(Math, xs),
          bottom: Math.min.apply(Math, ys),
          top: Math.max.apply(Math, ys)
        };
      }

      /** Planar angle avoids the alternative XYZ Euler branch around half turns. */
      function planarAngle(q) {
        return Math.atan2(2 * q.w * q.z, 1 - 2 * q.z * q.z) * 180 / Math.PI;
      }
      var runResult = exports('runResult', {
        height: 0,
        placed: 0,
        reason: 'calibration_end'
      });
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/play-view.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './HeightBackdrop.ts', './object-data.ts'], function (exports) {
  var _createForOfIteratorHelperLoose, cclegacy, Node, Layers, UITransform, Sprite, Widget, Vec3, isValid, Label, Color, HeightBackdrop, OBJECTS, UNITS_PER_METRE, PLATFORM_WIDTH, planarAngle, localBounds;
  return {
    setters: [function (module) {
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
      Node = module.Node;
      Layers = module.Layers;
      UITransform = module.UITransform;
      Sprite = module.Sprite;
      Widget = module.Widget;
      Vec3 = module.Vec3;
      isValid = module.isValid;
      Label = module.Label;
      Color = module.Color;
    }, function (module) {
      HeightBackdrop = module.HeightBackdrop;
    }, function (module) {
      OBJECTS = module.OBJECTS;
      UNITS_PER_METRE = module.UNITS_PER_METRE;
      PLATFORM_WIDTH = module.PLATFORM_WIDTH;
      planarAngle = module.planarAngle;
      localBounds = module.localBounds;
    }],
    execute: function () {
      cclegacy._RF.push({}, "30f97e2Ze5Uk4MiQkuSAJy1", "play-view", undefined);
      /** R6 artwork, with screen-space views of independent unscaled physics bodies. */
      var PlayView = exports('PlayView', /*#__PURE__*/function () {
        function PlayView(canvas, frames) {
          this.safe = void 0;
          this.input = void 0;
          this.rotate = void 0;
          this.pause = void 0;
          this.root = void 0;
          this.platform = void 0;
          this.claw = void 0;
          this.cable = void 0;
          this.hint = void 0;
          this.height = void 0;
          this.next = void 0;
          this.views = new Map();
          this.scale = 1.75;
          this.fitScale = 1;
          this.originY = 0;
          this.cameraY = 0;
          this.targetCameraY = 0;
          this.width = 0;
          this.heightPixels = 0;
          this.heldTop = 0;
          this.backdrop = void 0;
          this.canvas = canvas;
          this.frames = frames;
          this.safe = canvas.getChildByName('SafeArea');
          this.safe.getChildByName('World_1x').active = false;
          this.root = this.makeNode('PlayWorld', this.safe);
          this.root.setSiblingIndex(0);
          this.input = this.makeNode('PlayInput', this.safe);
          this.input.setSiblingIndex(1);
          this.platform = this.image('platform_city_base', this.root);
          this.cable = this.image('claw_cable_straight', this.root);
          this.claw = this.image('claw_open_narrow', this.root);
          this.rotate = this.safe.getChildByName('hud_rotate_90');
          this.pause = this.safe.getChildByName('hud_pause');
          this.height = this.safe.getChildByName('Text:0.0').getComponent(Label);
          this.next = this.safe.getChildByName('next_basketball').getComponent(Sprite);
          this.next.node.getComponent(Widget).enabled = false;
          var hintNode = this.makeNode('PlanningHint', this.safe);
          hintNode.getComponent(UITransform).setContentSize(440, 55);
          this.hint = hintNode.addComponent(Label);
          this.hint.string = '';
          this.hint.fontSize = 25;
          this.hint.lineHeight = 32;
          this.hint.color = Color.WHITE;
          this.hint.isBold = true;
          this.hint.enableOutline = true;
          this.hint.outlineWidth = 3;
          this.hint.outlineColor = new Color(23, 73, 144);
          this.backdrop = canvas.getComponent(HeightBackdrop);
          this.fit();
        }
        var _proto = PlayView.prototype;
        _proto.makeNode = function makeNode(name, parent) {
          var node = new Node(name);
          node.layer = Layers.Enum.UI_2D;
          parent.addChild(node);
          node.addComponent(UITransform);
          return node;
        };
        _proto.image = function image(name, parent) {
          var node = this.makeNode(name, parent);
          var sprite = node.addComponent(Sprite);
          sprite.spriteFrame = this.frames.get(name);
          sprite.sizeMode = Sprite.SizeMode.CUSTOM;
          sprite.trim = false;
          return node;
        };
        _proto.fit = function fit() {
          var size = this.safe.getComponent(UITransform).contentSize;
          if (size.width === this.width && size.height === this.heightPixels) return false;
          this.width = size.width;
          this.heightPixels = size.height;
          this.fitScale = Math.min(1, Math.max(.6, (size.height - 240) / 1094));
          this.scale = 1.75 * this.fitScale;
          // Contact plane passes through the wooden top, not its decorative back rim.
          this.originY = -size.height / 2 + 196 + 132 * this.fitScale;
          this.input.getComponent(UITransform).setContentSize(size.width, size.height);
          this.root.getComponent(UITransform).setContentSize(size.width, size.height);
          this.hint.node.setPosition(0, size.height / 2 - 370 * this.fitScale, 0);
          this.next.node.setPosition(297, size.height / 2 - 268, 0);
          for (var _iterator = _createForOfIteratorHelperLoose(this.safe.children), _step; !(_step = _iterator()).done;) {
            var _child$getComponent;
            var child = _step.value;
            (_child$getComponent = child.getComponent(Widget)) == null || _child$getComponent.updateAlignment();
          }
          return true;
        };
        _proto.beginPlacement = function beginPlacement(towerTop, maxObjectHeight) {
          if (towerTop === void 0) {
            towerTop = 0;
          }
          if (maxObjectHeight === void 0) {
            maxObjectHeight = 0;
          }
          this.fit();
          var localHeldTop = (this.heightPixels / 2 - 156.5 * this.fitScale - this.originY) / this.scale;
          if (towerTop > 0) {
            this.follow(towerTop);
            // Reserve space even when prior pieces are still gently moving and not scored.
            // Use the next piece's largest quarter-turn height so rotating cannot overlap the tower.
            this.targetCameraY = Math.max(this.targetCameraY, towerTop + maxObjectHeight + 24 - localHeldTop);
          }
          // Matches the approved cardboard position; rotation preserves this attachment height.
          this.heldTop = this.targetCameraY + localHeldTop;
          return {
            top: this.heldTop,
            left: -this.width / (2 * this.scale),
            right: this.width / (2 * this.scale),
            bottom: this.targetCameraY + (-this.heightPixels / 2 - this.originY) / this.scale
          };
        };
        _proto.pointerX = function pointerX(point) {
          var local = this.safe.getComponent(UITransform).convertToNodeSpaceAR(new Vec3(point.x, point.y, 0));
          return local.x / this.scale;
        };
        _proto.setNext = function setNext(kind) {
          var frame = this.frames.get("next_" + kind);
          this.next.spriteFrame = frame;
          this.next.sizeMode = Sprite.SizeMode.CUSTOM;
          // A shared world-to-preview scale preserves relative object sizes.
          // The image remains proportional; transparent padding is handled by the asset export.
          var size = frame.originalSize,
            spec = OBJECTS[kind];
          var previewScale = 62 / Math.max.apply(Math, Object.keys(OBJECTS).map(function (key) {
            return Math.max(OBJECTS[key].width, OBJECTS[key].height);
          }));
          var ratio = Math.max(spec.width, spec.height) * previewScale / Math.max(size.width, size.height);
          this.next.node.getComponent(UITransform).setContentSize(size.width * ratio, size.height * ratio);
        };
        _proto.setHint = function setHint(text) {
          this.hint.string = text;
        };
        _proto.setHeight = function setHeight(value) {
          this.height.string = (value / UNITS_PER_METRE).toFixed(1);
        };
        _proto.follow = function follow(top) {
          var threshold = (this.heightPixels * .05 - this.originY) / this.scale;
          this.targetCameraY = Math.max(this.targetCameraY, top - threshold);
        };
        _proto.update = function update(dt, records, held, retract, entering) {
          if (entering === void 0) {
            entering = false;
          }
          this.fit();
          this.cameraY += (this.targetCameraY - this.cameraY) * (1 - Math.exp(-7 * dt));
          // cameraY is already smoothed: scenery must use this same value in the same frame.
          this.backdrop.setViewHeight(this.cameraY / UNITS_PER_METRE, true, UNITS_PER_METRE * this.scale);
          var platformFrame = this.frames.get('platform_city_base').originalSize;
          var width = PLATFORM_WIDTH * this.scale,
            h = width * platformFrame.height / platformFrame.width;
          this.platform.getComponent(UITransform).setContentSize(width, h);
          // Adopted PNG: the wooden face center is row 82. Pixels only align the artwork;
          // PLATFORM_WIDTH and the physical support plane remain in world units.
          this.platform.setPosition(0, this.screenY(0) - h / 2 + width * 82 / platformFrame.width, 0);
          for (var _iterator2 = _createForOfIteratorHelperLoose(records), _step2; !(_step2 = _iterator2()).done;) {
            var record = _step2.value;
            this.paintBody(record);
          }
          this.paintClaw(held, retract, entering);
        };
        _proto.screenY = function screenY(y) {
          return this.originY + (y - this.cameraY) * this.scale;
        };
        _proto.paintBody = function paintBody(record) {
          var _record$spec$spriteOf;
          var node = this.views.get(record.id);
          if (!node) {
            node = this.image("object_" + record.spec.kind, this.root);
            this.views.set(record.id, node);
          }
          var p = record.node.position;
          var _ref = (_record$spec$spriteOf = record.spec.spriteOffset) != null ? _record$spec$spriteOf : [0, 0],
            offsetX = _ref[0],
            offsetY = _ref[1];
          var a = planarAngle(record.node.rotation) * Math.PI / 180;
          var x = p.x + offsetX * Math.cos(a) - offsetY * Math.sin(a);
          var y = p.y + offsetX * Math.sin(a) + offsetY * Math.cos(a);
          node.setPosition(x * this.scale, this.screenY(y), 0);
          // Copy the planar quaternion; Euler readback at 180 degrees can choose a different branch.
          node.setRotation(record.node.rotation);
          node.getComponent(UITransform).setContentSize(record.spec.spriteWidth * this.scale, record.spec.spriteHeight * this.scale);
        };
        _proto.paintClaw = function paintClaw(held, retract, entering) {
          this.claw.active = this.cable.active = held !== null || retract < 1;
          if (!this.claw.active) return;
          var name = held ? entering ? 'claw_open_mid' : 'claw_open_narrow' : retract < .35 ? 'claw_open_mid' : 'claw_open_wide';
          var frame = this.frames.get(name);
          this.claw.getComponent(Sprite).spriteFrame = frame;
          var height = 149 * this.fitScale,
            width = height * frame.originalSize.width / frame.originalSize.height;
          var x = held ? held.node.position.x * this.scale : this.claw.position.x;
          var attachment = held ? held.node.position.y + localBounds(held.spec, planarAngle(held.node.rotation)).top : this.heldTop;
          var top = this.screenY(attachment) + 113 * this.fitScale + (held ? 0 : retract * 220);
          this.claw.setPosition(x, top - height / 2, 0);
          this.claw.getComponent(UITransform).setContentSize(width, height);
          var cableHeight = Math.max(0, this.heightPixels / 2 - top + 18 * this.fitScale);
          this.cable.setPosition(x, this.heightPixels / 2 - cableHeight / 2, 0);
          this.cable.getComponent(UITransform).setContentSize(12 * this.fitScale, cableHeight);
          this.claw.setSiblingIndex(this.root.children.length - 1);
        };
        _proto.snapshot = function snapshot() {
          return {
            scale: this.scale,
            originY: this.originY,
            cameraY: this.cameraY,
            targetCameraY: this.targetCameraY,
            width: this.width,
            height: this.heightPixels,
            heldTop: this.heldTop
          };
        };
        _proto.dispose = function dispose() {
          for (var _i = 0, _arr = [this.root, this.input, this.hint.node]; _i < _arr.length; _i++) {
            var node = _arr[_i];
            if (isValid(node, true)) node.destroy();
          }
        };
        return PlayView;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/scene-actions.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './game-audio.ts', './local-platform.ts', './object-data.ts'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, cclegacy, _decorator, SpriteFrame, AudioClip, Label, director, Component, Sprite, GameAudio, bindAction, readSettings, writeSettings, runResult;
  return {
    setters: [function (module) {
      _applyDecoratedDescriptor = module.applyDecoratedDescriptor;
      _inheritsLoose = module.inheritsLoose;
      _initializerDefineProperty = module.initializerDefineProperty;
      _assertThisInitialized = module.assertThisInitialized;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      SpriteFrame = module.SpriteFrame;
      AudioClip = module.AudioClip;
      Label = module.Label;
      director = module.director;
      Component = module.Component;
      Sprite = module.Sprite;
    }, function (module) {
      GameAudio = module.GameAudio;
    }, function (module) {
      bindAction = module.bindAction;
      readSettings = module.readSettings;
      writeSettings = module.writeSettings;
    }, function (module) {
      runResult = module.runResult;
    }],
    execute: function () {
      var _dec, _dec2, _dec3, _dec4, _class, _class2, _descriptor, _descriptor2, _descriptor3;
      cclegacy._RF.push({}, "90165lzo9lQKrqlimSds8Fm", "scene-actions", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;

      /** Existing Home/Settings/Result art; only implemented fields and actions are active. */
      var StackSceneActions = exports('StackSceneActions', (_dec = ccclass('StackSceneActions'), _dec2 = property([SpriteFrame]), _dec3 = property(AudioClip), _dec4 = property(AudioClip), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(StackSceneActions, _Component);
        function StackSceneActions() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _initializerDefineProperty(_this, "frames", _descriptor, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "resultSound", _descriptor2, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "uiSound", _descriptor3, _assertThisInitialized(_this));
          _this.navigating = false;
          _this.audio = void 0;
          return _this;
        }
        var _proto = StackSceneActions.prototype;
        _proto.onLoad = function onLoad() {
          var _this2 = this;
          var scene = this.node.scene.name;
          var content = this.node.getChildByName('SafeArea').getChildByName('Content_1230');
          if (this.uiSound) {
            this.audio = new GameAudio(this.node, new Map([['next_handoff', this.uiSound]]));
            this.audio.play('ui_tap', .5);
          }
          if (scene === 'Home') {
            bindAction(content.getChildByName('btn_start'), function () {
              return _this2.go('HUD');
            });
            bindAction(content.getChildByName('btn_settings_icon'), function () {
              return _this2.go('Settings');
            });
          } else if (scene === 'Result') {
            if (this.resultSound) {
              this.audio = new GameAudio(this.node, new Map([['run_end', this.resultSound]]));
              this.audio.play('run_end', .75);
            }
            content.getChildByName('Text:本次叠到了').getComponent(Label).string = '本轮试放高度';
            content.getChildByName('Text:88.6 m').getComponent(Label).string = runResult.height.toFixed(1) + " m";
            for (var _i = 0, _arr = ['Text:新纪录！', 'result_death_reason_header', 'death_reason_collapse', 'Text:大量物体倒塌']; _i < _arr.length; _i++) {
              var name = _arr[_i];
              content.getChildByName(name).active = false;
            }
            bindAction(content.getChildByName('result_btn_retry'), function () {
              return _this2.go('HUD');
            });
          } else if (scene === 'Settings') {
            var keys = ['music', 'sound', 'vibration'];
            var toggles = content.children.filter(function (n) {
              return n.name.startsWith('toggle_');
            });
            toggles.forEach(function (node, i) {
              var key = keys[i];
              var paint = function paint() {
                node.getComponent(Sprite).spriteFrame = _this2.frames.find(function (f) {
                  return f.name === "toggle_" + (readSettings()[key] ? 'on' : 'off');
                });
              };
              paint();
              bindAction(node, function () {
                var _this2$audio, _this2$audio2;
                var settings = readSettings();
                settings[key] = !settings[key];
                writeSettings(settings);
                paint();
                if (key === 'sound') (_this2$audio = _this2.audio) == null || _this2$audio.pause(!settings.sound);
                (_this2$audio2 = _this2.audio) == null || _this2$audio2.play('ui_tap', .5);
              });
            });
            bindAction(content.getChildByName('btn_settings_base'), function () {
              return _this2.go('Home');
            });
          }
        };
        _proto.go = function go(scene) {
          var _this3 = this;
          if (this.navigating) return;
          this.navigating = true;
          director.loadScene(scene, function () {
            if (_this3.isValid) _this3.navigating = false;
          });
        };
        _proto.update = function update(dt) {
          var _this$audio;
          (_this$audio = this.audio) == null || _this$audio.update(dt);
        };
        _proto.onDestroy = function onDestroy() {
          var _this$audio2;
          (_this$audio2 = this.audio) == null || _this$audio2.dispose();
        };
        return StackSceneActions;
      }(Component), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "frames", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return [];
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "resultSound", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "uiSound", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      })), _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/tower-world.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './object-data.ts'], function (exports) {
  var _createForOfIteratorHelperLoose, cclegacy, Node, RigidBody2D, ERigidBody2DType, CircleCollider2D, PolygonCollider2D, BoxCollider2D, Vec2, Size, Contact2DType, RelativeJoint2D, isValid, director, Director, planarAngle, localBounds, PLATFORM_WIDTH;
  return {
    setters: [function (module) {
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
      Node = module.Node;
      RigidBody2D = module.RigidBody2D;
      ERigidBody2DType = module.ERigidBody2DType;
      CircleCollider2D = module.CircleCollider2D;
      PolygonCollider2D = module.PolygonCollider2D;
      BoxCollider2D = module.BoxCollider2D;
      Vec2 = module.Vec2;
      Size = module.Size;
      Contact2DType = module.Contact2DType;
      RelativeJoint2D = module.RelativeJoint2D;
      isValid = module.isValid;
      director = module.director;
      Director = module.Director;
    }, function (module) {
      planarAngle = module.planarAngle;
      localBounds = module.localBounds;
      PLATFORM_WIDTH = module.PLATFORM_WIDTH;
    }],
    execute: function () {
      cclegacy._RF.push({}, "353f4Z9ClpaEpNlLX0WGbG6", "tower-world", undefined);

      // Creator 3.8.8 point-velocity uses world units; linearVelocity uses Box2D metres.
      var COCOS_PTM_RATIO = 32;
      /** Physics nodes never inherit a screen, Canvas or presentation scale. */
      var TowerWorld = exports('TowerWorld', /*#__PURE__*/function () {
        function TowerWorld(scene, impact) {
          this.root = void 0;
          this.bodies = [];
          this.platform = void 0;
          this.nextId = 1;
          this.pendingAdhesion = new Map();
          this.bonds = new Map();
          this.impact = impact;
          this.root = new Node('TowerPhysics');
          scene.addChild(this.root);
          var node = new Node('GroundSupport');
          this.root.addChild(node);
          node.setPosition(0, -12, 0);
          node.addComponent(RigidBody2D).type = ERigidBody2DType.Static;
          this.platform = node.addComponent(BoxCollider2D);
          this.platform.size = new Size(PLATFORM_WIDTH, 24);
          this.platform.friction = .65;
          this.platform.restitution = 0;
          this.platform.apply();
          director.on(Director.EVENT_AFTER_PHYSICS, this.afterPhysics, this);
        }
        var _proto = TowerWorld.prototype;
        _proto.create = function create(spec, x, y) {
          var _this = this;
          var node = new Node("Body:" + this.nextId + ":" + spec.kind);
          this.root.addChild(node);
          node.setPosition(x, y, 0);
          var body = node.addComponent(RigidBody2D);
          body.type = ERigidBody2DType.Kinematic;
          body.allowSleep = true;
          body.enabledContactListener = true;
          body.linearDamping = .05;
          // Modest rotational drag damps impact chatter; unsupported bodies still tip and fall.
          var freeAngularDamping = spec.circle ? .1 : 1.5;
          body.angularDamping = freeAngularDamping;
          body.bullet = true;
          var collider = spec.circle ? node.addComponent(CircleCollider2D) : spec.outline ? node.addComponent(PolygonCollider2D) : node.addComponent(BoxCollider2D);
          collider.enabled = false;
          if (collider instanceof CircleCollider2D) collider.radius = spec.width / 2;else if (collider instanceof PolygonCollider2D) collider.points = spec.outline.map(function (_ref) {
            var x = _ref[0],
              y = _ref[1];
            return new Vec2(x, y);
          });else collider.size = new Size(spec.width, spec.height);
          collider.density = spec.density;
          collider.friction = spec.friction;
          collider.restitution = spec.restitution;
          var record = {
            id: this.nextId++,
            spec: spec,
            node: node,
            body: body,
            collider: collider,
            contacts: new Set(),
            placed: false,
            contactSeconds: null
          };
          // A concave PolygonCollider is partitioned into native fixtures. Keep public contacts
          // at object level, but retain each live native contact until its matching END event.
          var fixtureContacts = new Map();
          collider.on(Contact2DType.BEGIN_CONTACT, function (_self, other, contact) {
            var _active, _peer$id;
            if (record.contactSeconds === null) record.contactSeconds = 0;
            var active = fixtureContacts.get(other);
            if ((_active = active) != null && _active.has(contact)) return;
            if (!active) {
              active = new Set();
              fixtureContacts.set(other, active);
            }
            active.add(contact);
            if (active.size > 1) return;
            record.contacts.add(other);
            if (spec.contactAngularDamping !== undefined) body.angularDamping = spec.contactAngularDamping;
            var peer = _this.bodies.find(function (r) {
              return r.collider === other;
            });
            if (peer && peer.id > record.id) return;
            var velocity = body.linearVelocity.clone();
            if (other.body) velocity.subtract(other.body.linearVelocity);
            _this.impact == null || _this.impact(record, record.id + ":" + ((_peer$id = peer == null ? void 0 : peer.id) != null ? _peer$id : 0), velocity.length());
          });
          collider.on(Contact2DType.END_CONTACT, function (_self, other, contact) {
            var active = fixtureContacts.get(other);
            if (!(active != null && active["delete"](contact))) return;
            // A side graze on the same object must not keep an ended support contact eligible
            // for glue. Cocos recycles the contact object immediately after this END callback.
            for (var _iterator = _createForOfIteratorHelperLoose(_this.pendingAdhesion), _step; !(_step = _iterator()).done;) {
              var _step$value = _step.value,
                key = _step$value[0],
                pending = _step$value[1];
              if (pending.ball === record && pending.contact === contact) _this.pendingAdhesion["delete"](key);
            }
            if (active.size > 0) return;
            fixtureContacts["delete"](other);
            record.contacts["delete"](other);
            if (record.contacts.size === 0) body.angularDamping = freeAngularDamping;
          });
          if (spec.adhesion) collider.on(Contact2DType.PRE_SOLVE, function (_self, other, contact) {
            return _this.prepareAdhesion(record, other, contact);
          });
          this.bodies.push(record);
          return record;
        };
        _proto.prepareAdhesion = function prepareAdhesion(ball, other, contact) {
          if (!other.body || other.sensor) return;
          var manifold = contact.getWorldManifold();
          var normal = new Vec2(manifold.normal.x, manifold.normal.y);
          normal.multiplyScalar(contact.colliderA === ball.collider ? 1 : -1);
          if (Math.abs(normal.y) < .7 || !manifold.points.length) return;
          var side = Math.sign(normal.y),
            key = ball.id + ":" + side;
          if (this.bonds.has(key) || this.pendingAdhesion.has(key)) return;
          var peer = this.bodies.find(function (record) {
            return record.collider === other;
          });
          // A settled object brushing the top of a loose ball is not a new placement.
          if (side > 0 && (!peer || peer.placed || peer.id < ball.id)) return;
          this.pendingAdhesion.set(key, {
            ball: ball,
            other: other,
            side: side,
            contact: contact
          });
          var incoming = peer && peer.id > ball.id ? peer : ball;
          if (incoming.placed) return;
          var support = incoming === ball ? other.body : ball.body;
          if (incoming !== ball) normal.multiplyScalar(-1);
          this.cushionImpact(incoming.body, support, manifold.points[0], normal, ball.spec.adhesion.maxImpactSpeed);
        };
        _proto.cushionImpact = function cushionImpact(body, support, point, toward, limit) {
          var relative = body.getLinearVelocityFromWorldPoint(point, new Vec2());
          relative.subtract(support.getLinearVelocityFromWorldPoint(point, new Vec2()));
          var closing = body.linearVelocity.clone().subtract(support.linearVelocity).dot(toward);
          // Angular motion at an off-center contact must not reverse the body's translation.
          var excess = Math.min(relative.dot(toward) / COCOS_PTM_RATIO - limit, Math.max(0, closing));
          if (excess <= 0) return;
          // Local glue cushioning removes closing energy only at a real new contact.
          // Gravity, tangential motion, older bodies and free flight remain simulated.
          body.linearVelocity = body.linearVelocity.clone().subtract(toward.multiplyScalar(excess));
        };
        _proto.afterPhysics = function afterPhysics() {
          for (var _iterator2 = _createForOfIteratorHelperLoose(this.bonds), _step2; !(_step2 = _iterator2()).done;) {
            var _step2$value = _step2.value,
              key = _step2$value[0],
              bond = _step2$value[1];
            if (!this.bondIntact(bond)) {
              this.removeBond(bond);
              this.bonds["delete"](key);
            }
          }
          for (var _iterator3 = _createForOfIteratorHelperLoose(this.pendingAdhesion), _step3; !(_step3 = _iterator3()).done;) {
            var _step3$value = _step3.value,
              _key = _step3$value[0],
              pending = _step3$value[1];
            if (pending.ball.contacts.has(pending.other) && pending.other.enabledInHierarchy) {
              this.bonds.set(_key, this.attach(pending));
            }
          }
          this.pendingAdhesion.clear();
        };
        _proto.attach = function attach(contact) {
          var ball = contact.ball,
            other = contact.other,
            side = contact.side;
          var base = side < 0 ? other.body : ball.body;
          var attached = side < 0 ? ball.body : other.body;
          var offset = base.getLocalPoint(attached.getWorldPoint(new Vec2(), new Vec2()), new Vec2());
          var joint = base.node.addComponent(RelativeJoint2D);
          joint.connectedBody = attached;
          joint.autoCalcOffset = false;
          // Cocos auto offsets use world deltas. Explicit local offsets preserve rotated supports.
          joint.linearOffset = offset;
          joint.angularOffset = planarAngle(attached.node.rotation) - planarAngle(base.node.rotation);
          joint.maxForce = ball.spec.adhesion.maxForce;
          joint.maxTorque = ball.spec.adhesion.maxTorque;
          joint.correctionFactor = .4;
          joint.collideConnected = true;
          joint.apply();
          return {
            ball: ball,
            other: other,
            side: side,
            base: base,
            attached: attached,
            offset: offset,
            joint: joint
          };
        };
        _proto.bondIntact = function bondIntact(bond) {
          if (!isValid(bond.other, true) || !isValid(bond.ball.collider, true)) return false;
          if (!bond.other.enabledInHierarchy || !bond.ball.collider.enabledInHierarchy) return false;
          var offset = bond.base.getLocalPoint(bond.attached.getWorldPoint(new Vec2(), new Vec2()), new Vec2());
          return Vec2.distance(offset, bond.offset) <= bond.ball.spec.width * .12;
        };
        _proto.removeBond = function removeBond(bond) {
          if (!isValid(bond.joint, true)) return;
          // Disable while bodies still exist so Box2D removes the native joint before body teardown.
          bond.joint.enabled = false;
          bond.joint.destroy();
        };
        _proto.release = function release(record) {
          record.body.type = ERigidBody2DType.Dynamic;
          record.body.linearVelocity = new Vec2();
          record.body.angularVelocity = 0;
          record.collider.enabled = true;
          record.collider.apply();
          record.body.wakeUp();
        };
        _proto.isStable = function isStable() {
          return this.bodies.every(function (_ref2) {
            var body = _ref2.body,
              collider = _ref2.collider,
              contacts = _ref2.contacts;
            return !collider.enabled || contacts.size > 0 && body.linearVelocity.length() < .12 && Math.abs(body.angularVelocity) < .12;
          });
        }

        /** Generous handoff gate, separate from the strict stable-score threshold. */;
        _proto.hasPlacementHazard = function hasPlacementHazard() {
          return this.bodies.some(function (_ref3) {
            var body = _ref3.body,
              collider = _ref3.collider,
              contacts = _ref3.contacts,
              contactSeconds = _ref3.contactSeconds;
            if (!collider.enabled || contactSeconds === null) return false;
            return body.linearVelocity.y < -.75 || Math.abs(body.angularVelocity) > 1.5 || contacts.size === 0 && body.linearVelocity.y < -.12;
          });
        }

        /** Include every attached surface that handoff permits, including horizontal sliding. */;
        _proto.placementTop = function placementTop() {
          var _this2 = this;
          return Math.max.apply(Math, [0].concat(this.bodies.filter(function (_ref4) {
            var body = _ref4.body,
              collider = _ref4.collider,
              contacts = _ref4.contacts;
            return collider.enabled && contacts.size > 0 && body.linearVelocity.y >= -.75 && Math.abs(body.angularVelocity) <= 1.5;
          }).map(function (record) {
            return _this2.bounds(record).top;
          })));
        };
        _proto.bounds = function bounds(record) {
          var bounds = localBounds(record.spec, planarAngle(record.node.rotation)),
            p = record.node.position;
          return {
            left: p.x + bounds.left,
            right: p.x + bounds.right,
            bottom: p.y + bounds.bottom,
            top: p.y + bounds.top
          };
        };
        _proto.confirmedTop = function confirmedTop() {
          var _this3 = this;
          return Math.max.apply(Math, [0].concat(this.bodies.filter(function (r) {
            return r.placed;
          }).map(function (r) {
            return _this3.bounds(r).top;
          })));
        };
        _proto.dispose = function dispose() {
          director.off(Director.EVENT_AFTER_PHYSICS, this.afterPhysics, this);
          this.pendingAdhesion.clear();
          for (var _iterator4 = _createForOfIteratorHelperLoose(this.bonds.values()), _step4; !(_step4 = _iterator4()).done;) {
            var bond = _step4.value;
            this.removeBond(bond);
          }
          this.bonds.clear();
          if (isValid(this.root, true)) this.root.destroy();
        };
        return TowerWorld;
      }());
      cclegacy._RF.pop();
    }
  };
});

(function(r) {
  r('virtual:///prerequisite-imports/main', 'chunks:///_virtual/main'); 
})(function(mid, cid) {
    System.register(mid, [cid], function (_export, _context) {
    return {
        setters: [function(_m) {
            var _exportObj = {};

            for (var _key in _m) {
              if (_key !== "default" && _key !== "__esModule") _exportObj[_key] = _m[_key];
            }
      
            _export(_exportObj);
        }],
        execute: function () { }
    };
    });
});