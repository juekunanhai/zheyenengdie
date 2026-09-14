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
        impact_toilet: ['impact_ceramic_1', 'impact_ceramic_2', 'impact_ceramic_3'],
        impact_wooden_crate: ['impact_wood_1', 'impact_wood_2', 'impact_wood_3'],
        impact_sofa: ['impact_soft_1', 'impact_soft_2', 'impact_soft_3'],
        impact_burger: ['impact_soft_1', 'impact_soft_2', 'impact_soft_3'],
        impact_slipper: ['impact_soft_1', 'impact_soft_2', 'impact_soft_3'],
        impact_ice_block: ['impact_ice_1', 'impact_ice_2', 'impact_ice_3'],
        impact_whale: ['impact_heavy_1', 'impact_heavy_2', 'impact_heavy_3'],
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
              collision: false,
              pairKey: ''
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
            _this2 = this,
            _this$playedAt$get,
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
          var busy = function busy(v) {
            return v.source.playing || v.availableAt > _this2.clock;
          };
          var collision = name.startsWith('impact_');
          var level = Math.max(0, Math.min(.9, volume));
          var samePair = this.voices.filter(function (v) {
            return v.collision && v.pairKey === pairKey && busy(v);
          }).reduce(function (a, v) {
            return !a || v.source.volume > a.source.volume ? v : a;
          }, undefined);
          var cooling = this.clock - ((_this$playedAt$get = this.playedAt.get(pairKey)) != null ? _this$playedAt$get : -1) < .12;
          // Keep a stronger hit from the same pair; weaker contact chatter stays in cooldown.
          if (cooling && (!collision || !samePair || samePair.source.volume >= level)) return false;
          var impacts = this.voices.filter(function (v) {
            return v.collision && busy(v);
          });
          var weakest = impacts.reduce(function (a, v) {
            return !a || v.source.volume < a.source.volume ? v : a;
          }, undefined);
          // No deferred queue: when collapse fills the four impact slots, a stronger hit replaces
          // the quietest one immediately. Operation/star cues retain their reserved capacity.
          var voice = cooling ? samePair : collision && impacts.length >= 4 ? weakest && level > weakest.source.volume ? weakest : undefined : (_this$voices$find = this.voices.find(function (v) {
            return !busy(v);
          })) != null ? _this$voices$find : !collision ? weakest : undefined;
          if (!voice) return false;
          voice.source.stop();
          voice.source.clip = clip;
          voice.source.volume = level;
          voice.availableAt = this.clock + clip.getDuration() + .1;
          voice.collision = collision;
          voice.pairKey = pairKey;
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

System.register("chunks:///_virtual/game-controller.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './game-audio.ts', './game-music.ts', './incident-state.ts', './local-platform.ts', './object-data.ts', './play-view.ts', './tower-world.ts'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, _createForOfIteratorHelperLoose, cclegacy, _decorator, SpriteFrame, AudioClip, director, Vec2, Component, GameAudio, GameMusic, Incident, readSettings, RunLifecycle, TouchBinding, bindAction, writeSettings, PLANNING_SECONDS, CALIBRATION_SEQUENCE, OBJECTS, localBounds, MAX_OBSERVE_SECONDS, planarAngle, ENTER_SECONDS, STABLE_SECONDS, runResult, PlayView, TowerWorld;
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
      GameMusic = module.GameMusic;
    }, function (module) {
      Incident = module.Incident;
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
          _this.music = void 0;
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
          _this.stars = 3;
          _this.incident = null;
          _this.resumePhase = 'observing';
          _this.resumeClock = 0;
          _this.recoveryFor = 0;
          _this.incidentCount = 0;
          _this.failureReason = null;
          _this.normalBoundary = {
            top: 0,
            bottom: 0,
            left: 0,
            right: 0
          };
          _this.pendingResize = false;
          return _this;
        }
        var _proto = StackGameController.prototype;
        _proto.onLoad = function onLoad() {
          var _this2 = this;
          this.world = new TowerWorld(this.node.scene, function (record, pair, speed) {
            return _this2.impact(record, pair, speed);
          }, function (record) {
            return _this2.lost(record);
          });
          this.display = new PlayView(this.node, new Map(this.frames.map(function (frame) {
            return [frame.name, frame];
          })));
          this.audio = new GameAudio(this.node, new Map(this.approvedSounds.map(function (clip) {
            return [clip.name, clip];
          })));
          this.music = new GameMusic(this.node, new Map(this.approvedSounds.map(function (clip) {
            return [clip.name, clip];
          })));
          this.display.setStars(this.stars);
          this.tutorial = !readSettings().tutorialDone;
          this.lifecycle = new RunLifecycle(function (paused) {
            _this2.finger = null;
            _this2.audio.pause(paused);
            _this2.music.pause(paused);
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
          this.normalBoundary = this.display.logicalBounds();
          this.world.configureSafety(this.normalBoundary, this.peak);
          this.pendingResize = false;
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
          if (this.phase === 'defeated') {
            if (this.clock >= 1.2) this.commitResult();
            return;
          }
          for (var _iterator = _createForOfIteratorHelperLoose(this.world.bodies), _step; !(_step = _iterator()).done;) {
            var record = _step.value;
            if (record.lost || !record.collider.enabled) continue;
            if (record.contactSeconds !== null) record.contactSeconds = Math.min(MAX_OBSERVE_SECONDS, record.contactSeconds + delta);
          }
          if (!this.incident && this.world.collapseTrend()) this.beginIncident();
          if (this.incident) {
            this.updateIncident(dt);
            return;
          }
          this.confirmStable(dt);
          if (this.phase === 'entering') this.enter();else if (this.phase === 'planning') this.plan(dt);else if (this.phase === 'falling' || this.phase === 'observing') this.observe();
        };
        _proto.lateUpdate = function lateUpdate(dt) {
          var _this$current;
          if (!this.display || this.lifecycle.paused) return;
          var holdPhase = this.phase === 'incident' ? this.resumePhase : this.phase;
          var held = (holdPhase === 'planning' || holdPhase === 'entering') && !((_this$current = this.current) != null && _this$current.lost) ? this.current : null;
          if (this.display.fit()) {
            // A release/incident owns its rule boundary until a safe handoff.
            this.pendingResize = true;
            if (held && !this.incident && this.phase !== 'defeated') this.refitHeld();
          }
          this.display.update(Math.min(dt, .067), this.world.bodies, held, Math.min(1, this.clock / .24), holdPhase === 'entering');
          this.music.update(Math.min(dt, .067), this.display.getViewHeight(), this.incident !== null, this.phase === 'defeated' || this.phase === 'ended');
        };
        _proto.refitHeld = function refitHeld() {
          var held = this.current;
          this.boundary = this.display.beginPlacement(this.world.placementTop(), Math.max(held.spec.width, held.spec.height));
          this.normalBoundary = this.display.logicalBounds();
          this.world.configureSafety(this.normalBoundary, this.peak);
          var bounds = localBounds(held.spec, planarAngle(held.node.rotation));
          var x = Math.max(this.boundary.left - bounds.left + 4, Math.min(this.boundary.right - bounds.right - 4, held.node.position.x));
          held.node.setPosition(x, this.boundary.top - bounds.top, 0);
          this.pendingResize = false;
          this.finger = null;
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
          if (!this.display.cameraRecovered() || this.world.hasPlacementHazard()) {
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
          if (this.phase !== 'planning' || this.lifecycle.paused || this.finger !== null || !this.display.cameraRecovered()) return;
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
          if (this.phase !== 'planning' || !this.current || this.lifecycle.paused || !this.display.cameraRecovered()) return;
          var bounds = localBounds(this.current.spec, planarAngle(this.current.node.rotation));
          var clamped = Math.max(this.boundary.left - bounds.left + 4, Math.min(this.boundary.right - bounds.right - 4, x));
          this.current.node.setPosition(clamped, this.current.node.position.y, 0);
        };
        _proto.rotate = function rotate() {
          if (this.phase !== 'planning' || !this.current || this.lifecycle.paused || !this.display.cameraRecovered()) return;
          var current = this.current;
          this.rotations++;
          current.node.setRotationFromEuler(0, 0, -(this.rotations % 4) * 90);
          var bounds = localBounds(current.spec, -(this.rotations % 4) * 90);
          current.node.setPosition(current.node.position.x, this.boundary.top - bounds.top, 0);
          this.moveTo(current.node.position.x);
          this.audio.play('skill_rotate_90');
        };
        _proto.release = function release() {
          if (this.phase !== 'planning' || !this.current || this.lifecycle.paused || !this.display.cameraRecovered() || this.world.hasPlacementHazard()) return;
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
            if (record.lost || !record.collider.enabled || record.placed) continue;
            record.placed = true;
            confirmed++;
          }
          if (!confirmed) return;
          this.placedCount += confirmed;
          this.peak = Math.max(this.peak, this.world.confirmedTop());
          this.display.setHeight(this.peak);
          this.world.configureSafety(this.normalBoundary, this.peak);
          // Camera room is selected at handoff, independently of delayed score confirmation.
          // The approved stable cue is reserved for qualified highlights in Batch 2.
        };

        _proto.beginIncident = function beginIncident() {
          var _this4 = this;
          if (this.incident || this.phase === 'defeated' || this.phase === 'ended') return;
          var boundary = this.normalBoundary;
          var intersects = function intersects(a, b) {
            return a.left <= b.right && a.right >= b.left && a.top >= b.bottom && a.bottom <= b.top;
          };
          var placed = this.world.bodies.filter(function (record) {
            return record.placed && !record.lost;
          });
          var visible = placed.filter(function (record) {
            return intersects(_this4.world.nativeBounds(record), boundary);
          }).length;
          var zoom = visible >= 3 && visible <= 5 ? .75 : 1;
          var cx = (boundary.left + boundary.right) / 2,
            cy = (boundary.top + boundary.bottom) / 2;
          var halfWidth = (boundary.right - boundary.left) / (2 * zoom),
            halfHeight = (boundary.top - boundary.bottom) / (2 * zoom);
          var observation = {
            left: cx - halfWidth,
            right: cx + halfWidth,
            bottom: cy - halfHeight,
            top: cy + halfHeight
          };
          this.incident = new Incident(boundary, observation, this.peak, placed.filter(function (record) {
            return intersects(_this4.world.nativeBounds(record), observation);
          }).map(function (record) {
            return record.id;
          }), zoom);
          this.incidentCount++;
          this.resumePhase = this.phase;
          this.resumeClock = this.clock;
          this.phase = 'incident';
          this.clock = 0;
          this.recoveryFor = 0;
          this.finger = null;
          this.stableFor = 0;
          this.display.beginIncident(zoom);
          this.display.setHint('先稳住，等这一波掉落结束');
        }

        /** Called before the physical loss flag changes, so the first old piece belongs to the frozen set. */;
        _proto.lost = function lost(record) {
          if (this.phase === 'ended' || this.phase === 'defeated') return;
          this.beginIncident();
          var loss = this.incident.recordLoss(record.id);
          if (loss.duplicate) return;
          if (this.recoveryFor >= .6) this.display.holdIncident();
          this.recoveryFor = 0;
          if (loss.firstLoss) {
            this.stars = Math.max(0, this.stars - 1);
            this.display.setStars(this.stars);
            // The optional incident clip is bound only after its separate audio review.
            this.audio.play('star_lost', .65, "incident:" + this.incidentCount);
          }
          if (loss.collapse || this.stars === 0) this.lockFailure(loss.collapse ? 'large_collapse' : 'stars_exhausted');else this.display.setHint("\u8FD8\u5269 " + this.stars + " \u9897\u661F \xB7 \u7B49\u6389\u843D\u7ED3\u675F");
        };
        _proto.updateIncident = function updateIncident(dt) {
          var wasRecovering = this.recoveryFor >= .6;
          this.recoveryFor = this.world.remainingStable() && !this.world.collapseTrend() ? this.recoveryFor + dt : 0;
          if (wasRecovering && this.recoveryFor === 0) this.display.holdIncident();
          if (this.recoveryFor < .6) return;
          if (!wasRecovering) this.display.endIncident();
          if (!this.display.cameraRecovered()) return;
          this.incident = null;
          this.recoveryFor = 0;
          if (this.current && !this.current.lost) {
            this.phase = this.resumePhase;
            this.clock = this.resumeClock;
            if (this.pendingResize && (this.phase === 'planning' || this.phase === 'entering')) this.refitHeld();
          } else {
            // The missed piece consumed one release; NEXT remains the already advertised item.
            this.spawn();
          }
          this.display.setHint('');
        };
        _proto.lockFailure = function lockFailure(reason) {
          if (this.phase === 'defeated' || this.phase === 'ended') return;
          this.failureReason = reason;
          if (this.current && !this.current.collider.enabled) this.current.node.active = false;
          this.phase = 'defeated';
          this.clock = 0;
          this.finger = null;
          runResult.height = this.peak / 100;
          runResult.placed = this.placedCount;
          runResult.reason = reason;
          this.display.setHint(reason === 'large_collapse' ? '这次倒得有点多…' : '星星用完啦');
          // Physics may finish the collapse, but no further input, score or result changes are allowed.
        }

        /** Local reviewer can end a run explicitly; ordinary play uses the incident rules. */;
        _proto.finish = function finish(reason) {
          if (reason === void 0) {
            reason = 'calibration_end';
          }
          if (this.phase === 'ended' || this.phase === 'defeated') return;
          this.lockFailure(reason);
          this.commitResult();
        };
        _proto.commitResult = function commitResult() {
          if (this.phase === 'ended') return;
          this.phase = 'ended';
          this.clock = 0;
          this.finger = null;
          var settings = readSettings();
          settings.tutorialDone = true;
          writeSettings(settings);
          this.audio.pause(true);
          this.music.pause(true);
          director.loadScene('Result');
        };
        _proto.impact = function impact(record, pair, speed) {
          if (record.lost || speed < .6 || this.phase === 'ended') return;
          var bounds = this.world.bounds(record);
          if (bounds.top < this.boundary.bottom || bounds.right < this.boundary.left || bounds.left > this.boundary.right) return;
          this.audio.play("impact_" + record.spec.kind, Math.min(.85, .25 + speed * .035), pair);
        }

        /** Read-only diagnostics used by the local calibration page. */;
        _proto.snapshot = function snapshot() {
          var _this$incident$snapsh,
            _this$incident,
            _this$current2,
            _this$current3,
            _this5 = this;
          return {
            phase: this.phase,
            releases: this.releaseCount,
            placed: this.placedCount,
            peakMetres: this.peak / 100,
            stars: this.stars,
            incidentCount: this.incidentCount,
            incident: (_this$incident$snapsh = (_this$incident = this.incident) == null ? void 0 : _this$incident.snapshot()) != null ? _this$incident$snapsh : null,
            recoverySeconds: this.recoveryFor,
            failureReason: this.failureReason,
            normalBoundary: this.normalBoundary,
            safety: this.world.safetySnapshot(),
            sequence: [].concat(this.sequence),
            untimedCalibration: this.untimedCalibration,
            observationSeconds: (_this$current2 = this.current) == null ? void 0 : _this$current2.contactSeconds,
            maxObserveSeconds: MAX_OBSERVE_SECONDS,
            placementBlocked: this.world.hasPlacementHazard(),
            placementTop: this.world.placementTop(),
            stabilizers: this.world.stabilizerSnapshot(),
            secondsLeft: this.planningLeft,
            tutorial: this.tutorial,
            paused: this.lifecycle.paused,
            boundary: this.boundary,
            view: this.display.snapshot(),
            music: this.music.snapshot(),
            audioClips: this.approvedSounds.length,
            currentId: (_this$current3 = this.current) == null ? void 0 : _this$current3.id,
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
                lost: r.lost,
                supported: r.supported,
                detachedSeconds: r.detachedSeconds,
                fallingSeconds: r.fallingSeconds,
                assistDamping: r.assistDamping,
                placed: r.placed,
                type: r.body.type,
                scale: r.node.worldScale.clone(),
                bounds: _this5.world.bounds(r)
              };
            })
          };
        };
        _proto.onDestroy = function onDestroy() {
          var _this$audio, _this$music, _this$touches, _this$lifecycle, _this$world, _this$display;
          (_this$audio = this.audio) == null || _this$audio.dispose();
          (_this$music = this.music) == null || _this$music.dispose();
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

System.register("chunks:///_virtual/game-music.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './local-platform.ts'], function (exports) {
  var _createForOfIteratorHelperLoose, cclegacy, warn, isValid, AudioSource, Node, readSettings, hasUserInteraction;
  return {
    setters: [function (module) {
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
      warn = module.warn;
      isValid = module.isValid;
      AudioSource = module.AudioSource;
      Node = module.Node;
    }, function (module) {
      readSettings = module.readSettings;
      hasUserInteraction = module.hasUserInteraction;
    }],
    execute: function () {
      cclegacy._RF.push({}, "e4458fpAz5dOqJ4103GZfLM", "game-music", undefined);
      var TRACKS = ['bgm_city', 'bgm_cloud', 'bgm_space'];
      var CROSSFADE_SECONDS = 1;
      /** Two prerecorded arrangements of one theme can overlap; no live stems or music queue. */
      var GameMusic = exports('GameMusic', /*#__PURE__*/function () {
        function GameMusic(node, clips) {
          var _this = this;
          this.voices = [];
          this.active = -1;
          this.fadingFrom = -1;
          this.fade = 1;
          this.gain = 0;
          this.suspended = false;
          this.loadingSeconds = 0;
          this.issues = new Set();
          this.clips = clips;
          var _loop = function _loop(i) {
            var child = new Node("Music:" + i);
            node.addChild(child);
            var source = child.addComponent(AudioSource);
            source.playOnAwake = false;
            source.loop = true;
            source.volume = 0;
            var started = function started() {
              return _this.started(i);
            };
            child.on(AudioSource.EventType.STARTED, started);
            _this.voices.push({
              source: source,
              region: -1,
              ready: false,
              started: started
            });
          };
          for (var i = 0; i < 2; i++) {
            _loop(i);
          }
          for (var _iterator = _createForOfIteratorHelperLoose(TRACKS), _step; !(_step = _iterator()).done;) {
            var _clips$get;
            var id = _step.value;
            if (!((_clips$get = clips.get(id)) != null && _clips$get.getDuration())) this.issue("missing:" + id);
          }
        }

        /** View/camera height, never the record score. Midpoints match the visual transitions. */
        var _proto = GameMusic.prototype;
        _proto.update = function update(dt, viewHeight, incident, defeated) {
          if (incident === void 0) {
            incident = false;
          }
          if (defeated === void 0) {
            defeated = false;
          }
          if (!readSettings().music || !hasUserInteraction()) {
            this.stop();
            return;
          }
          if (this.suspended) return;
          var region = viewHeight >= 160 ? 2 : viewHeight >= 55 ? 1 : 0;
          if (this.active < 0) this.start(region);
          if (this.active < 0) return; // Missing audio never blocks the run.
          if (this.fadingFrom < 0 && this.voices[this.active].region !== region) this.start(region);
          var targetGain = defeated ? 0 : incident ? .09 : .22;
          this.gain += Math.sign(targetGain - this.gain) * Math.min(Math.abs(targetGain - this.gain), dt * .3);
          // AudioPlayer.load is asynchronous. Keep the previous phrase audible until STARTED.
          if (!this.voices[this.active].ready) {
            this.loadingSeconds += dt;
            if (this.loadingSeconds >= 8) this.issue("not-started:" + TRACKS[this.voices[this.active].region]);
            if (this.fadingFrom >= 0) this.voices[this.fadingFrom].source.volume = this.gain;
            return;
          }
          this.fade = Math.min(1, this.fade + dt / CROSSFADE_SECONDS);
          this.voices[this.active].source.volume = this.gain * this.fade;
          if (this.fadingFrom >= 0) {
            var old = this.voices[this.fadingFrom].source;
            old.volume = this.gain * (1 - this.fade);
            if (this.fade === 1) {
              old.stop();
              old.clip = null;
              this.fadingFrom = -1;
            }
          }
        };
        _proto.start = function start(region) {
          var clip = this.clips.get(TRACKS[region]);
          if (!clip || clip.getDuration() <= 0) return;
          var previous = this.active;
          var next = previous < 0 ? 0 : 1 - previous;
          var voice = this.voices[next];
          // The three offline arrangements have equal lengths and the same bar/phrase grid.
          var time = previous < 0 ? 0 : this.voices[previous].source.currentTime % clip.getDuration();
          voice.source.stop();
          voice.source.clip = clip;
          voice.source.volume = 0;
          voice.source.currentTime = time;
          voice.region = region;
          voice.ready = false;
          this.active = next;
          this.fadingFrom = previous;
          this.fade = previous < 0 ? 1 : 0;
          this.loadingSeconds = 0;
          voice.source.play();
        };
        _proto.started = function started(index) {
          var voice = this.voices[index];
          if (index !== this.active || voice.ready) return;
          voice.ready = true;
          if (this.fadingFrom >= 0) voice.source.currentTime = this.voices[this.fadingFrom].source.currentTime % voice.source.duration;
          if (this.suspended || !readSettings().music) voice.source.pause();
        };
        _proto.issue = function issue(message) {
          if (this.issues.has(message)) return;
          this.issues.add(message);
          warn("[GameMusic] " + message);
        };
        _proto.pause = function pause(value) {
          if (this.suspended === value) return;
          this.suspended = value;
          this.applyPause();
        };
        _proto.applyPause = function applyPause() {
          if (!readSettings().music || !hasUserInteraction()) {
            this.stop();
            return;
          }
          for (var _i = 0, _arr = [this.active, this.fadingFrom]; _i < _arr.length; _i++) {
            var index = _arr[_i];
            if (index < 0) continue;
            var source = this.voices[index].source;
            if (this.suspended) source.pause();else if (!source.playing) source.play();
          }
        };
        _proto.stop = function stop() {
          if (this.active < 0) return;
          for (var _iterator2 = _createForOfIteratorHelperLoose(this.voices), _step2; !(_step2 = _iterator2()).done;) {
            var voice = _step2.value;
            if (isValid(voice.source, true)) {
              voice.source.stop();
              voice.source.clip = null;
            }
            voice.region = -1;
            voice.ready = false;
          }
          this.active = this.fadingFrom = -1;
          this.fade = 1;
          this.gain = 0;
        };
        _proto.snapshot = function snapshot() {
          return {
            region: this.active < 0 ? null : TRACKS[this.voices[this.active].region],
            fading: this.fadingFrom >= 0,
            fade: this.fade,
            gain: this.gain,
            paused: this.suspended,
            enabled: readSettings().music,
            issues: Array.from(this.issues),
            sources: this.voices.map(function (voice) {
              var _voice$source$clip$na, _voice$source$clip;
              return {
                clip: (_voice$source$clip$na = (_voice$source$clip = voice.source.clip) == null ? void 0 : _voice$source$clip.name) != null ? _voice$source$clip$na : null,
                playing: voice.source.playing,
                time: voice.source.currentTime,
                volume: voice.source.volume
              };
            })
          };
        };
        _proto.dispose = function dispose() {
          for (var _iterator3 = _createForOfIteratorHelperLoose(this.voices), _step3; !(_step3 = _iterator3()).done;) {
            var _voice$source$node;
            var voice = _step3.value;
            (_voice$source$node = voice.source.node) == null || _voice$source$node.off(AudioSource.EventType.STARTED, voice.started);
          }
          this.stop();
        };
        return GameMusic;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/HeightBackdrop.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, _createForOfIteratorHelperLoose, cclegacy, _decorator, SpriteFrame, Sprite, Rect, Size, Vec2, Node, UITransform, UIOpacity, game, Game, Component;
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
      Sprite = module.Sprite;
      Rect = module.Rect;
      Size = module.Size;
      Vec2 = module.Vec2;
      Node = module.Node;
      UITransform = module.UITransform;
      UIOpacity = module.UIOpacity;
      game = module.game;
      Game = module.Game;
      Component = module.Component;
    }],
    execute: function () {
      exports('backdropOpacity', backdropOpacity);
      var _dec, _dec2, _dec3, _class, _class2, _descriptor, _descriptor2;
      cclegacy._RF.push({}, "fa1e0x5LFxRfZnAjwZR1Ute", "HeightBackdrop", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;

      /** Visual tuning only. Input is camera/view height above the ground, never score. */
      var BACKDROP_TRANSITIONS = exports('BACKDROP_TRANSITIONS', [[3, 12], [40, 70], [130, 190]]);
      function backdropOpacity(height, start, end) {
        var t = Math.min(1, Math.max(0, (height - start) / (end - start)));
        return t * t * (3 - 2 * t);
      }

      /** Batch 0 presentation component; no input, physics, score or tower state. */
      var HeightBackdrop = exports('HeightBackdrop', (_dec = ccclass('HeightBackdrop'), _dec2 = property(SpriteFrame), _dec3 = property(SpriteFrame), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(HeightBackdrop, _Component);
        function HeightBackdrop() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _initializerDefineProperty(_this, "cloudFrame", _descriptor, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "groundForegroundFrame", _descriptor2, _assertThisInitialized(_this));
          _this.targetHeight = 0;
          _this.shownHeight = 0;
          _this.layers = [];
          _this.skyEdges = [];
          _this.edgeFrames = [];
          _this.pixelsPerMetre = 175;
          _this.worldZoom = 1;
          _this.lastWidth = 0;
          _this.lastHeight = 0;
          _this.clouds = [];
          _this.groundForeground = null;
          _this.elapsed = 0;
          _this.hidden = false;
          _this.hide = function () {
            _this.hidden = true;
          };
          _this.show = function () {
            _this.hidden = false;
          };
          return _this;
        }
        var _proto = HeightBackdrop.prototype;
        _proto.onLoad = function onLoad() {
          var _this2 = this;
          this.layers = ['bg_ground_city', 'bg_city_altitude', 'bg_cloud_altitude', 'bg_space_altitude'].map(function (name) {
            return _this2.node.getChildByName(name);
          });
          // One distant skyline avoids double buildings while the ground moves with the tower.
          if (this.groundForegroundFrame) this.layers[0].getComponent(Sprite).spriteFrame = this.layers[1].getComponent(Sprite).spriteFrame;
          this.skyEdges = this.layers.map(function (layer) {
            return _this2.createSkyEdge(layer);
          });
          this.createGroundForeground();
          this.createClouds();
          this.fit();
          this.paint();
        }

        /** Call from the camera presenter in Batch 1; QA supplies an explicit sample now. */;
        _proto.setViewHeight = function setViewHeight(heightM, immediate, pixelsPerMetre, worldZoom) {
          if (immediate === void 0) {
            immediate = false;
          }
          if (pixelsPerMetre === void 0) {
            pixelsPerMetre = 175;
          }
          if (worldZoom === void 0) {
            worldZoom = 1;
          }
          this.pixelsPerMetre = pixelsPerMetre;
          this.worldZoom = worldZoom;
          this.targetHeight = Number.isFinite(heightM) ? Math.max(0, heightM) : 0;
          if (immediate) {
            this.shownHeight = this.targetHeight;
            this.paint();
          }
        };
        _proto.getViewHeight = function getViewHeight() {
          return this.shownHeight;
        }

        /** The new environment art reserves a clear sky edge, without clouds to stretch. */;
        _proto.createSkyEdge = function createSkyEdge(layer) {
          var source = layer.getComponent(Sprite).spriteFrame;
          var frame = source.clone();
          var stripHeight = Math.min(24, source.rect.height);
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
        _proto.onEnable = function onEnable() {
          game.on(Game.EVENT_HIDE, this.hide);
          game.on(Game.EVENT_SHOW, this.show);
        };
        _proto.onDisable = function onDisable() {
          game.off(Game.EVENT_HIDE, this.hide);
          game.off(Game.EVENT_SHOW, this.show);
        };
        _proto.onDestroy = function onDestroy() {
          for (var _iterator = _createForOfIteratorHelperLoose(this.edgeFrames), _step; !(_step = _iterator()).done;) {
            var frame = _step.value;
            frame.destroy();
          }
        };
        _proto.createGroundForeground = function createGroundForeground() {
          if (!this.groundForegroundFrame) return;
          var ground = this.groundForeground = new Node('GroundForeground');
          ground.layer = this.node.layer;
          this.node.addChild(ground);
          ground.setSiblingIndex(this.node.getChildByName('SafeArea').getSiblingIndex());
          ground.addComponent(UITransform);
          var sprite = ground.addComponent(Sprite);
          sprite.spriteFrame = this.groundForegroundFrame;
          sprite.sizeMode = Sprite.SizeMode.CUSTOM;
          sprite.trim = false;
          ground.addComponent(UIOpacity);
        };
        _proto.createClouds = function createClouds() {
          if (!this.cloudFrame) return;
          for (var i = 0; i < 3; i++) {
            var cloud = new Node("BackdropCloud" + i);
            cloud.layer = this.node.layer;
            this.node.addChild(cloud);
            cloud.setSiblingIndex(this.node.getChildByName('SafeArea').getSiblingIndex());
            cloud.addComponent(UITransform);
            var sprite = cloud.addComponent(Sprite);
            sprite.spriteFrame = this.cloudFrame;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.trim = false;
            cloud.addComponent(UIOpacity);
            this.clouds.push(cloud);
          }
        };
        _proto.update = function update(dt) {
          this.fit();
          if (!this.hidden) this.elapsed += Math.min(dt, .05);
          this.paintClouds();
          if (Math.abs(this.shownHeight - this.targetHeight) < .001) return;
          this.shownHeight += (this.targetHeight - this.shownHeight) * (1 - Math.exp(-6 * dt));
          if (Math.abs(this.shownHeight - this.targetHeight) < .001) this.shownHeight = this.targetHeight;
          this.paint();
        };
        _proto.paintClouds = function paintClouds() {
          var _this3 = this;
          if (!this.cloudFrame) return;
          var size = this.node.getComponent(UITransform).contentSize;
          var ratio = this.cloudFrame.originalSize.height / this.cloudFrame.originalSize.width;
          var fade = 1 - .65 * backdropOpacity(this.shownHeight, 130, 190);
          var positions = [[-.45, .13, .43, 29, .4], [.47, .02, .34, 37, 2.1], [-.43, -.16, .26, 43, 4.2]];
          this.clouds.forEach(function (cloud, i) {
            var _positions$i = positions[i],
              x = _positions$i[0],
              y = _positions$i[1],
              width = _positions$i[2],
              period = _positions$i[3],
              phase = _positions$i[4];
            var t = _this3.elapsed * Math.PI * 2 / period + phase;
            var drift = Math.sin(t) * size.width * .055;
            var lift = Math.cos(t * .7) * 5;
            cloud.getComponent(UITransform).setContentSize(size.width * width, size.width * width * ratio);
            cloud.setPosition(size.width * x + drift, size.height * y + lift, 0);
            cloud.getComponent(UIOpacity).opacity = (i === 0 ? 170 : 135) * fade;
          });
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
          var _this4 = this;
          var alphas = [1].concat(BACKDROP_TRANSITIONS.map(function (_ref) {
            var start = _ref[0],
              end = _ref[1];
            return backdropOpacity(_this4.shownHeight, start, end);
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
              parallax = [_this4.groundForeground ? .16 : 1, .16, .025, .008][i];
            var travel = Math.max(0, _this4.shownHeight - start) * _this4.pixelsPerMetre * parallax;
            var size = layer.getComponent(UITransform);
            layer.setPosition(0, (size.height - _this4.lastHeight) / 2 - travel, 0);
            var gap = Math.max(0, _this4.lastHeight - size.height + travel);
            var edge = _this4.skyEdges[i];
            edge.active = layer.active && gap > 0;
            edge.getComponent(UIOpacity).opacity = Math.round(alphas[i] * 255);
            var visibleGap = Math.min(_this4.lastHeight, gap);
            edge.getComponent(UITransform).setContentSize(size.width, visibleGap + 1);
            edge.setPosition(0, _this4.lastHeight / 2 - visibleGap / 2, 0);
          });
          if (this.groundForeground) {
            var ground = this.groundForeground;
            var size = this.layers[0].getComponent(UITransform);
            ground.getComponent(UITransform).setContentSize(size.contentSize);
            ground.setScale(this.worldZoom, this.worldZoom, 1);
            ground.setPosition(0, ((size.height - this.lastHeight) / 2 - this.shownHeight * this.pixelsPerMetre) * this.worldZoom, 0);
            ground.getComponent(UIOpacity).opacity = Math.round((1 - alphas[1]) * 255);
            ground.active = alphas[1] < 1;
          }
          this.paintClouds();
        };
        return HeightBackdrop;
      }(Component), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "cloudFrame", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "groundForegroundFrame", [_dec3], {
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

System.register("chunks:///_virtual/incident-state.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _extends, _createClass, cclegacy;
  return {
    setters: [function (module) {
      _extends = module.extends;
      _createClass = module.createClass;
    }, function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      cclegacy._RF.push({}, "2c188NBz2dFv41sTFC2TFsu", "incident-state", undefined);
      /** Normal 1x world coordinates. Presentation zoom never changes these limits. */
      /** One continuous incident. The caller owns time, stars, input and scene transitions. */
      var Incident = exports('Incident', /*#__PURE__*/function () {
        function Incident(boundary, observation, referenceTop, members, zoom) {
          this.boundary = void 0;
          this.observation = void 0;
          this.referenceTop = void 0;
          this.members = void 0;
          this.zoom = void 0;
          this.N = void 0;
          this.K = void 0;
          this.memberIDs = void 0;
          this.losses = new Set();
          this.charged = false;
          this.memberLosses = 0;
          this.boundary = Object.freeze(_extends({}, boundary));
          this.observation = Object.freeze(_extends({}, observation));
          this.referenceTop = referenceTop;
          // Only already-placed, valid bodies belong here; eligibility is the caller's responsibility.
          this.memberIDs = new Set(members);
          this.members = Object.freeze(Array.from(this.memberIDs));
          this.N = this.members.length;
          this.K = this.N < 3 ? null : Math.min(6, Math.max(3, Math.ceil(this.N * .6)));
          this.zoom = zoom;
        }
        var _proto = Incident.prototype;
        _proto.recordLoss = function recordLoss(id) {
          if (this.losses.has(id)) return {
            firstLoss: false,
            duplicate: true,
            collapse: this.collapse
          };
          this.losses.add(id);
          if (this.memberIDs.has(id)) this.memberLosses++;
          var firstLoss = !this.charged;
          this.charged = true;
          return {
            firstLoss: firstLoss,
            duplicate: false,
            collapse: this.collapse
          };
        };
        _proto.snapshot = function snapshot() {
          return {
            boundary: _extends({}, this.boundary),
            observation: _extends({}, this.observation),
            referenceTop: this.referenceTop,
            zoom: this.zoom,
            members: this.members.slice(),
            N: this.N,
            K: this.K,
            lostIDs: this.lostIDs,
            lostMemberCount: this.memberLosses,
            starCharged: this.charged,
            collapse: this.collapse
          };
        };
        _createClass(Incident, [{
          key: "starCharged",
          get: function get() {
            return this.charged;
          }
        }, {
          key: "lostIDs",
          get: function get() {
            return Array.from(this.losses);
          }
        }, {
          key: "lostMemberCount",
          get: function get() {
            return this.memberLosses;
          }
        }, {
          key: "collapse",
          get: function get() {
            return this.K !== null && this.memberLosses >= this.K;
          }
        }]);
        return Incident;
      }());
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

System.register("chunks:///_virtual/main", ['./HeightBackdrop.ts', './HomePresentation.ts', './ResultPresentation.ts', './game-audio.ts', './game-controller.ts', './game-music.ts', './incident-state.ts', './local-platform.ts', './object-data.ts', './play-view.ts', './scene-actions.ts', './tower-world.ts'], function () {
  return {
    setters: [null, null, null, null, null, null, null, null, null, null, null, null],
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
      /** difficulty-r1 candidates: visible bearing geometry, contact cushioning and local plank support.
       * Formal source scale remains unchanged; candidate provenance is in preparation/design/difficulty-r1.
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
          width: 100.912779,
          height: 100,
          circle: false,
          spriteWidth: 102.636917,
          spriteHeight: 101.926978,
          spriteOffset: [0.05071, -0.05071],
          outline: [[-50.456389, 39.858012], [-50.456389, -46.957404], [-47.413793, -50], [47.413793, -50], [50.456389, -46.957404], [50.456389, 39.858012], [39.908722, 50], [-37.576065, 50]],
          friction: 0.65,
          restitution: 0.02,
          density: 0.45115949058,
          contactAngularDamping: 6,
          contactImpactSpeed: 2.4
        },
        wood_plank: {
          kind: 'wood_plank',
          width: 260,
          height: 28.744805,
          circle: false,
          spriteWidth: 263.674148,
          spriteHeight: 32.851205,
          spriteOffset: [0.108063, -0.108063],
          outline: [[-130, 8.536991], [-130, -10.049875], [-125.029094, -14.372402], [125.029094, -14.372402], [130, -10.049875], [130, 8.536991], [124.596841, 14.372402], [-124.596841, 14.372402]],
          friction: 0.65,
          restitution: 0.02,
          density: 0.481043899512,
          contactAngularDamping: 6,
          contactImpactSpeed: 2.4,
          stabilizer: {
            "maxForce": 420,
            "maxTorque": 95,
            "maxImpactSpeed": 1.8,
            "maxAngleError": 12
          },
          description: "搭上一块稳固板，上下都踏实一点。"
        },
        basketball: {
          kind: 'basketball',
          width: 68,
          height: 68,
          circle: true,
          spriteWidth: 70.2295,
          spriteHeight: 70.2295,
          friction: 0.85,
          restitution: 0.03,
          density: 0.4,
          contactAngularDamping: 6,
          adhesion: {
            "maxForce": 1500,
            "maxTorque": 150,
            "maxImpactSpeed": 2
          },
          description: "别担心，有人给它贴了双面胶。"
        },
        fridge: {
          kind: 'fridge',
          width: 150,
          height: 167.554858636,
          circle: false,
          spriteWidth: 152.664576818,
          spriteHeight: 170.219435455,
          spriteOffset: [0.078369545, -0.078369545],
          outline: [[-74.843259545, 65.909090455], [-75, -65.125392273], [-57.601880455, -83.77743], [57.445141364, -83.77743], [75, -66.065830909], [74.843259545, 66.22257], [57.288400909, 83.77743], [-57.601880455, 83.77743]],
          friction: 0.6,
          restitution: 0.01,
          density: 0.293776465351,
          contactAngularDamping: 6,
          contactImpactSpeed: 2.4
        },
        toilet: {
          kind: 'toilet',
          width: 150.900515,
          height: 115,
          circle: false,
          spriteWidth: 154.64837,
          spriteHeight: 118.5506,
          spriteOffset: [0.098628, 0],
          outline: [[-74.266724, 54.738422], [-75.450257, 51.582333], [-74.858491, 46.848199], [-72.096913, 44.875643], [-70.518868, 18.837907], [-67.165523, -1.084906], [-63.417667, -7.791595], [-57.697256, -9.764151], [-52.174099, -16.668096], [-48.031732, -22.191252], [-46.256432, -28.897942], [-47.637221, -34.421098], [-50.596055, -40.141509], [-56.119211, -44.678388], [-63.023156, -47.834477], [-66.573756, -51.187822], [-67.75729, -55.921955], [-64.601201, -57.5], [64.009434, -57.5], [67.362779, -54.541166], [65.192967, -49.01801], [59.078045, -45.46741], [56.316467, -41.127787], [54.738422, -35.21012], [56.513722, -32.054031], [63.417667, -28.503431], [68.546312, -24.163808], [72.294168, -17.654374], [74.463979, -9.566895], [75.450257, -1.282161], [73.280446, 2.465695], [67.560034, 4.43825], [24.95283, 4.43825], [22.585763, 4.240995], [24.95283, 45.861921], [27.517153, 47.24271], [28.108919, 51.779588], [26.925386, 55.330189], [21.993997, 57.5], [-68.940823, 57.5]],
          friction: 0.62,
          restitution: 0.015,
          density: 0.401990728786,
          contactAngularDamping: 6,
          contactImpactSpeed: 2.4
        },
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
          density: 1.1,
          contactAngularDamping: 6,
          contactImpactSpeed: 2.4
        },
        wooden_crate: {
          kind: 'wooden_crate',
          width: 120.0,
          height: 110.143416,
          circle: false,
          spriteWidth: 122.659713,
          spriteHeight: 112.803129,
          spriteOffset: [0.078227, -0.078227],
          outline: [[-59.530639, 49.28292], [-60.0, 35.984355], [-58.435463, 33.637549], [-58.435463, -34.576271], [-60.0, -37.392438], [-60.0, -50.847458], [-57.340287, -54.445893], [-55.77575, -55.071708], [-42.946545, -55.071708], [-41.225554, -54.132986], [41.382008, -54.132986], [42.946545, -55.071708], [55.932203, -55.071708], [59.687093, -52.099087], [60.0, -37.079531], [58.435463, -34.576271], [58.435463, 33.637549], [60.0, 35.514993], [60.0, 48.344198], [54.211213, 54.602347], [39.973924, 54.915254], [38.878748, 53.820078], [-38.722295, 53.820078], [-39.817471, 54.915254], [-52.333768, 55.071708], [-54.367666, 54.445893]],
          friction: 0.68,
          restitution: 0.01,
          density: 0.385401841055,
          contactAngularDamping: 6,
          contactImpactSpeed: 2.4
        },
        ice_block: {
          kind: 'ice_block',
          width: 119.687093,
          height: 77.444589,
          circle: false,
          spriteWidth: 122.659713,
          spriteHeight: 80.41721,
          spriteOffset: [0.078227, -0.078227],
          outline: [[-58.122555, 30.11734], [-59.843546, 24.954368], [-59.843546, -26.831812], [-56.714472, -34.028683], [-52.490222, -37.314211], [-48.735332, -38.565841], [46.857888, -38.722295], [53.428944, -36.84485], [57.653194, -32.777053], [59.843546, -26.675359], [59.843546, 25.110821], [57.183833, 31.681877], [51.238592, 37.157757], [46.701434, 38.565841], [-45.606258, 38.722295], [-49.361147, 37.940026], [-53.585398, 35.59322]],
          friction: 0.3,
          restitution: 0.01,
          density: 0.508738237677,
          contactAngularDamping: 6,
          contactImpactSpeed: 2.4
        },
        sofa: {
          kind: 'sofa',
          width: 180.0,
          height: 81.66884,
          circle: false,
          spriteWidth: 183.98957,
          spriteHeight: 85.658409,
          spriteOffset: [0.11734, -0.11734],
          outline: [[-89.530639, 7.040417], [-90.0, -13.142112], [-89.061278, -34.498044], [-87.887875, -38.252934], [-84.367666, -40.599739], [-71.460235, -40.83442], [-68.174707, -39.426336], [-65.123859, -40.83442], [65.123859, -40.83442], [68.409387, -39.426336], [71.225554, -40.83442], [82.724902, -40.83442], [86.479791, -39.661017], [88.826597, -35.671447], [90.0, -9.621904], [90.0, 4.693611], [88.826597, 8.683181], [83.898305, 12.907432], [73.57236, 18.539765], [60.899609, 19.009126], [60.430248, 28.161669], [59.256845, 33.559322], [56.440678, 37.548892], [50.808344, 40.130378], [40.013038, 40.83442], [10.912647, 40.599739], [3.402868, 39.191656], [0.352021, 36.610169], [-2.933507, 39.426336], [-12.32073, 40.83442], [-38.604954, 40.83442], [-51.277705, 39.661017], [-55.736636, 37.548892], [-59.022164, 33.089961], [-60.430248, 26.518905], [-60.899609, 19.009126], [-71.694915, 19.009126], [-74.511082, 18.070404], [-86.01043, 11.499348], [-88.357236, 9.387223]],
          friction: 0.8,
          restitution: 0.01,
          density: 0.329983425303,
          contactAngularDamping: 6,
          contactImpactSpeed: 2.4
        },
        whale: {
          kind: 'whale',
          width: 225.0,
          height: 96.512386,
          circle: false,
          spriteWidth: 229.986962,
          spriteHeight: 101.499348,
          spriteOffset: [0.146675, -0.146675],
          outline: [[-112.5, -8.360495], [-108.39309, -21.854628], [-102.819426, -30.068449], [-97.245763, -35.348761], [-92.845502, -38.282269], [-84.925033, -42.095828], [-76.417862, -44.735984], [-58.523468, -47.376141], [-36.815515, -48.256193], [0.146675, -48.256193], [34.468709, -46.496089], [43.269231, -45.029335], [52.363103, -42.389179], [61.750326, -37.988918], [67.32399, -34.175359], [74.071056, -28.014993], [77.884615, -23.321382], [81.404824, -17.747718], [82.871578, -13.640808], [84.631682, -11.880704], [89.911995, -11.294003], [97.539113, -8.653846], [106.046284, -2.20013], [109.273142, 2.20013], [111.326597, 6.600391], [112.5, 11.000652], [112.5, 15.107562], [109.859844, 19.801173], [102.819426, 22.147979], [96.07236, 21.267927], [89.031943, 17.454368], [86.978488, 23.028031], [82.284876, 28.308344], [75.83116, 31.535202], [69.964146, 31.535202], [67.61734, 30.361799], [65.270535, 27.721643], [63.21708, 21.267927], [63.51043, 15.987614], [64.683833, 12.174055], [67.910691, 6.30704], [71.137549, 2.786832], [68.204042, 2.493481], [65.270535, 3.666884], [62.337027, 6.600391], [52.949804, 23.614733], [45.322686, 32.415254], [38.575619, 37.402216], [28.014993, 42.389179], [18.33442, 45.029335], [1.613429, 47.376141], [-14.52086, 48.256193], [-36.522164, 48.256193], [-51.776402, 47.376141], [-63.51043, 45.616037], [-75.244459, 42.389179], [-86.098435, 37.108866], [-94.312256, 30.948501], [-101.646023, 23.321382], [-108.39309, 12.760756], [-111.913299, 1.613429]],
          friction: 0.72,
          restitution: 0.01,
          density: 0.421008967097,
          contactAngularDamping: 6,
          contactImpactSpeed: 2.4
        },
        burger: {
          kind: 'burger',
          width: 130.0,
          height: 103.636364,
          circle: false,
          spriteWidth: 138.181818,
          spriteHeight: 111.363636,
          spriteOffset: [0.454545, -0.227273],
          outline: [[-54.545455, 42.272727], [-58.636364, 35.0], [-59.545455, 31.363636], [-61.363636, 30.0], [-63.181818, 26.363636], [-62.727273, 22.727273], [-60.0, 19.090909], [-62.727273, 15.909091], [-64.545455, 12.272727], [-65.0, 8.636364], [-63.181818, 5.454545], [-58.181818, 4.090909], [-62.272727, -2.727273], [-63.636364, -9.090909], [-63.181818, -10.454545], [-61.363636, -11.818182], [-59.090909, -10.909091], [-58.181818, -11.363636], [-57.727273, -15.454545], [-60.909091, -20.454545], [-61.363636, -23.181818], [-60.454545, -25.909091], [-57.727273, -28.181818], [-58.181818, -32.727273], [-56.363636, -40.0], [-51.363636, -45.909091], [-40.0, -51.818182], [40.909091, -51.818182], [52.727273, -45.454545], [55.454545, -42.727273], [58.636364, -36.818182], [59.545455, -33.181818], [59.545455, -27.727273], [62.272727, -24.545455], [62.272727, -20.454545], [60.0, -15.454545], [60.909091, -8.181818], [63.636364, -7.727273], [65.0, -5.909091], [65.0, -1.818182], [64.090909, 0.909091], [59.090909, 8.636364], [60.0, 13.636364], [63.636364, 17.272727], [64.090909, 21.818182], [61.818182, 26.363636], [58.636364, 29.545455], [57.272727, 34.545455], [54.545455, 40.0], [47.727273, 47.727273], [43.181818, 50.454545], [40.454545, 50.454545], [39.545455, 51.363636], [36.818182, 51.818182], [-39.545455, 51.818182], [-40.454545, 50.909091], [-45.454545, 50.454545], [-51.363636, 45.909091]],
          friction: 0.8,
          restitution: 0.01,
          density: 0.271579711642,
          contactAngularDamping: 6,
          contactImpactSpeed: 2.4
        },
        slipper: {
          kind: 'slipper',
          width: 165.0,
          height: 92.082153,
          circle: false,
          spriteWidth: 174.348442,
          spriteHeight: 101.898017,
          spriteOffset: [0.0, -0.233711],
          outline: [[82.032578, 3.038244], [80.16289, 8.179887], [75.488669, 16.593484], [70.347025, 22.20255], [65.205382, 25.941926], [57.259207, 29.681303], [51.18272, 31.083569], [45.573654, 33.888102], [35.290368, 37.627479], [30.616147, 38.562323], [26.876771, 40.432011], [23.137394, 40.899433], [6.310198, 46.041076], [-1.168555, 46.041076], [-4.44051, 45.106232], [-9.114731, 42.3017], [-14.723796, 36.692635], [-17.995751, 32.018414], [-32.953258, 34.355524], [-45.573654, 34.355524], [-54.922096, 32.018414], [-63.803116, 27.811615], [-72.216714, 21.267705], [-75.488669, 17.528329], [-79.695467, 10.516997], [-82.032578, 3.505666], [-82.5, -7.712465], [-80.630312, -17.060907], [-76.890935, -25.007082], [-73.61898, -28.746459], [-66.607649, -33.42068], [-61.466006, -35.290368], [-44.171388, -39.497167], [-20.332861, -43.236544], [4.907932, -46.041076], [24.072238, -46.041076], [33.888102, -45.106232], [48.378187, -41.366856], [60.531161, -35.75779], [71.28187, -27.811615], [76.423513, -21.735127], [81.097734, -13.32153], [82.5, -7.245042]],
          friction: 0.8,
          restitution: 0.01,
          density: 0.245651470001,
          contactAngularDamping: 6,
          contactImpactSpeed: 2.4
        }
      });
      // Batch 1C base sequence: friendly opening, twelve kinds, with boards offered as real turns.
      // A risk-aware or randomized director remains a later batch.
      var CALIBRATION_SEQUENCE = exports('CALIBRATION_SEQUENCE', ["cardboard_box", "wood_plank", "fridge", "wooden_crate", "sofa", "whale", "wood_plank", "burger", "ice_block", "dumbbell", "wood_plank", "toilet", "slipper", "basketball"]);
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
          this.zoom = 1;
          this.zoomFrom = 1;
          this.zoomTarget = 1;
          this.zoomTime = 0;
          this.zoomDuration = .35;
          this.incidentCamera = false;
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
        }

        /** Normal full viewport, separate from the claw attachment and presentation zoom. */;
        _proto.logicalBounds = function logicalBounds() {
          return {
            top: this.targetCameraY + (this.heightPixels / 2 - this.originY) / this.scale,
            bottom: this.targetCameraY + (-this.heightPixels / 2 - this.originY) / this.scale,
            left: -this.width / (2 * this.scale),
            right: this.width / (2 * this.scale)
          };
        };
        _proto.beginIncident = function beginIncident(zoom) {
          this.incidentCamera = true;
          this.zoomFrom = this.zoom;
          this.zoomTarget = zoom;
          this.zoomTime = 0;
          this.zoomDuration = .35;
        };
        _proto.endIncident = function endIncident() {
          this.incidentCamera = false;
          this.zoomFrom = this.zoom;
          this.zoomTarget = 1;
          this.zoomTime = 0;
          this.zoomDuration = .45;
        };
        _proto.holdIncident = function holdIncident() {
          // A renewed fall during recovery belongs to the same chain; stop the lens in place.
          this.incidentCamera = true;
          this.zoomFrom = this.zoomTarget = this.zoom;
          this.zoomTime = this.zoomDuration;
        };
        _proto.cameraRecovered = function cameraRecovered() {
          return !this.incidentCamera && this.zoom === 1;
        };
        _proto.setStars = function setStars(count) {
          var _this = this;
          this.safe.children.filter(function (node) {
            return node.name === 'hud_star_full';
          }).forEach(function (node, index) {
            node.getComponent(Sprite).spriteFrame = _this.frames.get(index < count ? 'hud_star_full' : 'hud_star_empty');
          });
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
        _proto.getViewHeight = function getViewHeight() {
          return this.cameraY / UNITS_PER_METRE;
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
          this.zoomTime = Math.min(this.zoomDuration, this.zoomTime + dt);
          var t = this.zoomTime / this.zoomDuration;
          this.zoom = t === 1 ? this.zoomTarget : this.zoomFrom + (this.zoomTarget - this.zoomFrom) * t * t * (3 - 2 * t);
          // Only the independent world presentation zooms. Logical coordinates and HUD stay fixed.
          this.root.setScale(this.zoom, this.zoom, 1);
          // cameraY is already smoothed: scenery must use this same value in the same frame.
          this.backdrop.setViewHeight(this.cameraY / UNITS_PER_METRE, true, UNITS_PER_METRE * this.scale, this.zoom);
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
          node.active = !record.lost && record.node.active;
          if (!node.active) return;
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
            heldTop: this.heldTop,
            zoom: this.zoom,
            zoomTarget: this.zoomTarget,
            incidentCamera: this.incidentCamera
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

System.register("chunks:///_virtual/ResultPresentation.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './object-data.ts'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, _createForOfIteratorHelperLoose, cclegacy, _decorator, SpriteFrame, Graphics, game, Game, Node, UITransform, Sprite, UIOpacity, Color, Component, runResult;
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
      Graphics = module.Graphics;
      game = module.game;
      Game = module.Game;
      Node = module.Node;
      UITransform = module.UITransform;
      Sprite = module.Sprite;
      UIOpacity = module.UIOpacity;
      Color = module.Color;
      Component = module.Component;
    }, function (module) {
      runResult = module.runResult;
    }],
    execute: function () {
      var _dec, _dec2, _class, _class2, _descriptor;
      cclegacy._RF.push({}, "0f8adU2L4xbSaiNEnkMj7Rg", "ResultPresentation", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;

      /** A compact score card over the approved Home art. Decorations are never a run screenshot. */
      var ResultPresentation = exports('ResultPresentation', (_dec = ccclass('ResultPresentation'), _dec2 = property([SpriteFrame]), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(ResultPresentation, _Component);
        function ResultPresentation() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _initializerDefineProperty(_this, "heightFrames", _descriptor, _assertThisInitialized(_this));
          _this.safe = void 0;
          _this.content = void 0;
          _this.card = void 0;
          _this.homeArt = void 0;
          _this.backdrop = void 0;
          _this.dim = void 0;
          _this.width = 0;
          _this.height = 0;
          _this.safeWidth = 0;
          _this.safeHeight = 0;
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
        var _proto = ResultPresentation.prototype;
        _proto.onLoad = function onLoad() {
          var _this2 = this;
          this.safe = this.node.getChildByName('SafeArea');
          this.content = this.safe.getChildByName('Content_1230');
          this.card = this.content.getChildByName('ResultCard');
          this.homeArt = this.node.getChildByName('ResultHomeArt');
          this.backdrop = this.node.getChildByName('ResultHomeBackdrop');
          this.dim = this.node.getChildByName('ResultDim').addComponent(Graphics);
          var _loop = function _loop() {
            var _button$getChildByNam;
            var name = _arr[_i];
            var button = _this2.card.getChildByName(name);
            var visual = (_button$getChildByNam = button.getChildByName('CloseVisual')) != null ? _button$getChildByNam : button.getChildByName('RetryVisual');
            button.on(Node.EventType.TOUCH_START, function () {
              return visual.setScale(.96, .96, 1);
            });
            button.on(Node.EventType.TOUCH_END, function () {
              return visual.setScale(1, 1, 1);
            });
            button.on(Node.EventType.TOUCH_CANCEL, function () {
              return visual.setScale(1, 1, 1);
            });
          };
          for (var _i = 0, _arr = ['result_btn_retry', 'result_btn_close']; _i < _arr.length; _i++) {
            _loop();
          }
          this.setHeight(runResult.height);
          this.fit();
          this.paintEntry();
        };
        _proto.onEnable = function onEnable() {
          game.on(Game.EVENT_HIDE, this.hide);
          game.on(Game.EVENT_SHOW, this.show);
        };
        _proto.onDisable = function onDisable() {
          game.off(Game.EVENT_HIDE, this.hide);
          game.off(Game.EVENT_SHOW, this.show);
          this.resetButtons();
        }

        /** Layout image glyphs from the genuine result; never bake a sample score into the card. */;
        _proto.setHeight = function setHeight(height) {
          var _this3 = this;
          var value = Number.isFinite(height) ? Math.max(0, height) : 0;
          var text = value.toFixed(1) + "m";
          var treatment = this.card.getChildByName('HeightTreatment');
          // setHeight is also used by the local layout reviewer: remove obsolete digits first.
          for (var _i2 = 0, _arr2 = [].concat(treatment.children); _i2 < _arr2.length; _i2++) {
            var child = _arr2[_i2];
            child.removeFromParent();
            child.destroy();
          }
          // Creator's loose transpiler treats [...string] as one array element.
          var glyphs = text.split('').map(function (_char) {
            var key = _char === '.' ? 'dot' : _char;
            var frame = _this3.heightFrames.find(function (item) {
              return item.name === "result_r13_height_" + key;
            });
            var height = (_char === 'm' ? 30 : _char === '.' ? 20 : 52) * 2.3;
            return {
              "char": _char,
              frame: frame,
              height: height,
              width: height * frame.originalSize.width / frame.originalSize.height
            };
          });
          var overlap = 12 * 2.3;
          var width = glyphs.reduce(function (total, glyph) {
            return total + glyph.width;
          }, 0) - overlap * (glyphs.length - 1);
          var scale = Math.min(1, 161 * 2.3 / width);
          var x = -width * scale / 2;
          for (var _iterator = _createForOfIteratorHelperLoose(glyphs), _step; !(_step = _iterator()).done;) {
            var glyph = _step.value;
            var node = new Node("HeightGlyph:" + glyph["char"]);
            node.layer = treatment.layer;
            treatment.addChild(node);
            node.addComponent(UITransform).setContentSize(glyph.width * scale, glyph.height * scale);
            var sprite = node.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.trim = false;
            sprite.spriteFrame = glyph.frame;
            node.setPosition(x + glyph.width * scale / 2, (-52 * 2.3 / 2 + glyph.height / 2) * scale, 0);
            x += (glyph.width - overlap) * scale;
          }
        };
        _proto.update = function update(dt) {
          this.fit();
          if (!this.hidden) this.elapsed += Math.min(dt, .05);
          this.paintEntry();
          this.paintClouds();
        };
        _proto.resetButtons = function resetButtons() {
          if (!this.card) return;
          for (var _i3 = 0, _arr3 = ['result_btn_retry', 'result_btn_close']; _i3 < _arr3.length; _i3++) {
            var _button$getChildByNam2;
            var name = _arr3[_i3];
            var button = this.card.getChildByName(name);
            ((_button$getChildByNam2 = button.getChildByName('CloseVisual')) != null ? _button$getChildByNam2 : button.getChildByName('RetryVisual')).setScale(1, 1, 1);
          }
        };
        _proto.paintEntry = function paintEntry() {
          var t = Math.min(1, this.elapsed / .24);
          var eased = 1 - Math.pow(1 - t, 3);
          var scale = .965 + .035 * eased;
          this.card.setScale(scale, scale, 1);
          this.card.setPosition(0, -10 * (1 - eased), 0);
          this.card.getComponent(UIOpacity).opacity = 190 + 65 * eased;
        };
        _proto.fit = function fit() {
          var canvas = this.node.getComponent(UITransform);
          var safe = this.safe.getComponent(UITransform);
          if (canvas.width === this.width && canvas.height === this.height && safe.width === this.safeWidth && safe.height === this.safeHeight) return;
          this.width = canvas.width;
          this.height = canvas.height;
          this.safeWidth = safe.width;
          this.safeHeight = safe.height;
          // The card and both hit targets remain inside the safe area, including short screens.
          var scale = Math.min(canvas.width / 750, canvas.height / 1334);
          var cardScale = Math.min(canvas.width / 750, safe.width / 750, safe.height / 820);
          this.content.setScale(cardScale, cardScale, 1);
          this.content.setPosition(0, 0, 0);
          var backdropSource = this.backdrop.getComponent(Sprite).spriteFrame.originalSize;
          var cover = Math.max(canvas.width / backdropSource.width, canvas.height / backdropSource.height);
          this.backdrop.getComponent(UITransform).setContentSize(backdropSource.width * cover, backdropSource.height * cover);
          this.backdrop.setPosition(0, (backdropSource.height * cover - canvas.height) / 2, 0);
          this.dim.node.getComponent(UITransform).setContentSize(canvas.width, canvas.height);
          this.dim.clear();
          this.dim.fillColor = new Color(14, 38, 76, 135);
          this.dim.rect(-canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
          this.dim.fill();

          // Match the existing approved Home composition; only the overlay is interactive.
          var height = canvas.height / scale;
          var extra = height - 1334;
          this.homeArt.setScale(scale, scale, 1);
          this.homeArt.getComponent(UITransform).setContentSize(750, height);
          var heroWidth = 470 + extra * .35;
          var heroLeft = 185 - (heroWidth - 470) / 2;
          var heroTop = height - 145 - heroWidth * 1507 / 1024;
          var shoeLeft = heroLeft + heroWidth * 450 / 1024 - 129;
          this.placeHome('R9Hero', heroLeft, heroTop, heroWidth, heroWidth * 1.5);
          this.placeHome('R9SlipperBack', shoeLeft - 45, heroTop - 136, 144, 144 * 257 / 340);
          this.placeHome('R9SlipperFront', shoeLeft, heroTop - 121, 194, 194 * 257 / 340);
          this.placeHome('R9WoodBoard', 22, height * .49, 226, 310);
          var logoWidth = 560 + extra * .2;
          var logoHeight = logoWidth * 732 / 1381;
          var logoTop = heroTop - 136 - logoHeight - 12;
          this.placeHome('logo_main', (750 - logoWidth) / 2, logoTop, logoWidth, logoHeight);
          this.placeHome('HomeAirship', 9, logoTop + 102, 112, 64);
          this.placeHome('HomeAirplane', 645, logoTop + 296, 99, 99 * 94 / 159);
          this.paintClouds();
        };
        _proto.placeHome = function placeHome(name, left, top, width, height) {
          var node = this.homeArt.getChildByName(name);
          node.getComponent(UITransform).setContentSize(width, height);
          var totalHeight = this.homeArt.getComponent(UITransform).height;
          node.setPosition(left + width / 2 - 375, totalHeight / 2 - top - height / 2, 0);
        };
        _proto.paintClouds = function paintClouds() {
          var _this4 = this;
          var extra = this.homeArt.getComponent(UITransform).height - 1334;
          var positions = [[-170, 300 + extra * .12, 340, 25, 7, 140, 7], [610, 490 + extra * .2, 290, 28, 13, -140, -8], [-105, 732 + extra * .25, 185, 27, 17, 110, 6]];
          positions.forEach(function (_ref, i) {
            var x = _ref[0],
              y = _ref[1],
              width = _ref[2],
              duration = _ref[3],
              offset = _ref[4],
              travel = _ref[5],
              lift = _ref[6];
            var weight = (1 - Math.cos(Math.PI * (_this4.elapsed + offset) / duration)) / 2;
            var name = "R9Cloud" + i;
            var source = _this4.homeArt.getChildByName(name).getComponent(Sprite).spriteFrame.originalSize;
            _this4.placeHome(name, x + travel * weight, y + lift * weight, width, width * source.height / source.width);
          });
        };
        return ResultPresentation;
      }(Component), _descriptor = _applyDecoratedDescriptor(_class2.prototype, "heightFrames", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return [];
        }
      }), _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/scene-actions.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './game-audio.ts', './local-platform.ts'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, cclegacy, _decorator, SpriteFrame, AudioClip, director, Component, Sprite, GameAudio, bindAction, readSettings, writeSettings;
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
      director = module.director;
      Component = module.Component;
      Sprite = module.Sprite;
    }, function (module) {
      GameAudio = module.GameAudio;
    }, function (module) {
      bindAction = module.bindAction;
      readSettings = module.readSettings;
      writeSettings = module.writeSettings;
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
            var card = content.getChildByName('ResultCard');
            bindAction(card.getChildByName('result_btn_retry'), function () {
              return _this2.go('HUD');
            });
            bindAction(card.getChildByName('result_btn_close'), function () {
              return _this2.go('Home');
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
  var _extends, _createForOfIteratorHelperLoose, cclegacy, Node, RigidBody2D, ERigidBody2DType, CircleCollider2D, PolygonCollider2D, BoxCollider2D, Vec2, Size, Contact2DType, game, RelativeJoint2D, isValid, director, Director, localBounds, planarAngle, PLATFORM_WIDTH;
  return {
    setters: [function (module) {
      _extends = module.extends;
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
      game = module.game;
      RelativeJoint2D = module.RelativeJoint2D;
      isValid = module.isValid;
      director = module.director;
      Director = module.Director;
    }, function (module) {
      localBounds = module.localBounds;
      planarAngle = module.planarAngle;
      PLATFORM_WIDTH = module.PLATFORM_WIDTH;
    }],
    execute: function () {
      cclegacy._RF.push({}, "353f4Z9ClpaEpNlLX0WGbG6", "tower-world", undefined);

      // Creator 3.8.8 point-velocity uses world units; linearVelocity uses Box2D metres.
      var COCOS_PTM_RATIO = 32;
      // Small contact gaps do not turn an old supported tower into a loss. These are 1B tuning candidates.
      var DETACH_GRACE_SECONDS = .12;
      var FALL_SPEED = -.75;
      var FALL_SECONDS = .12;
      var MAX_DEEP_ASSIST = 8;
      /** Compare physical angles across the -180/180 degree representation boundary. */
      function wrapAngle(angle) {
        return ((angle + 180) % 360 + 360) % 360 - 180;
      }

      /** Creator 3.8.8 Box2D WASM exposes GetAngle() in radians with complete turns.
       * MotorJoint needs that original difference; quaternion angles could introduce
       * a spurious full-turn correction at attachment. Only error checks should wrap. */
      function relativeBodyAngle(base, attached) {
        var baseNative = base.impl.impl;
        var attachedNative = attached.impl.impl;
        return (attachedNative.GetAngle() - baseNative.GetAngle()) * 180 / Math.PI;
      }

      /** Initial overlaps must not become a motor's permanent target against contact resolution.
       * Creator's bundled Box2D linearSlop is .005 m. Preserve that solver tolerance,
       * correcting the target only along the actual support normal; never move either body. */
      function contactOffset(base, attached, baseCollider, contact) {
        var offset = base.getLocalPoint(attached.getWorldPoint(new Vec2(), new Vec2()), new Vec2());
        var manifold = contact.getWorldManifold();
        var correction = Math.max(0, -Math.min.apply(Math, manifold.separations) - .005 * COCOS_PTM_RATIO);
        if (correction > 0) {
          var sign = contact.colliderA === baseCollider ? 1 : -1;
          var normal = new Vec2(manifold.normal.x * sign * correction, manifold.normal.y * sign * correction);
          offset.add(base.getLocalVector(normal, new Vec2()));
        }
        return offset;
      }

      /** Physics nodes never inherit a screen, Canvas or presentation scale. */
      var TowerWorld = exports('TowerWorld', /*#__PURE__*/function () {
        function TowerWorld(scene, impact, onLoss) {
          this.root = void 0;
          this.bodies = [];
          this.platform = void 0;
          this.nextId = 1;
          this.pendingAdhesion = new Map();
          this.bonds = new Map();
          this.cushionedBodies = new Set();
          this.pendingStabilizers = new Map();
          this.stabilizerBonds = new Map();
          // A torn connection cannot continually reconnect and consume more fall energy.
          this.brokenStabilizers = new Set();
          this.safety = null;
          // Keep copied support directions, never query a pooled Cocos contact after END_CONTACT.
          this.supportContacts = new Map();
          // A brief contact gap may reconnect only to its original, still grounded bearing surface.
          this.supportReturns = new Map();
          this.losing = new Set();
          this.safetyTime = 0;
          this.safetyDt = 0;
          this.filteredContacts = 0;
          this.impact = impact;
          this.onLoss = onLoss;
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
          director.on(Director.EVENT_BEFORE_PHYSICS, this.beforePhysics, this);
          director.on(Director.EVENT_AFTER_PHYSICS, this.afterPhysics, this);
        }
        var _proto = TowerWorld.prototype;
        _proto.create = function create(spec, x, y) {
          var _this = this;
          var node = new Node("Body:" + this.nextId + ":" + spec.kind);
          // Configure off-scene: Creator reads the plain `bullet` field only when creating the
          // native body. Adding an active node first silently left native IsBullet() false.
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
            lost: false,
            supported: false,
            detachedSeconds: 0,
            fallingSeconds: 0,
            assistDamping: 0,
            contactSeconds: null
          };
          // A concave PolygonCollider is partitioned into native fixtures. Keep public contacts
          // at object level, but retain each live native contact until its matching END event.
          var fixtureContacts = new Map();
          collider.on(Contact2DType.BEGIN_CONTACT, function (_self, other, contact) {
            var _active, _peer$id;
            if (_this.rejectContact(record, other, contact)) return;
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
            if (spec.contactAngularDamping !== undefined) body.angularDamping = spec.contactAngularDamping + record.assistDamping;
            var peer = _this.bodies.find(function (r) {
              return r.collider === other;
            });
            if (peer && peer.id > record.id) return;
            var velocity = body.linearVelocity.clone();
            if (other.body) velocity.subtract(other.body.linearVelocity);
            _this.impact == null || _this.impact(record, record.id + ":" + ((_peer$id = peer == null ? void 0 : peer.id) != null ? _peer$id : 0), velocity.length());
          });
          collider.on(Contact2DType.END_CONTACT, function (_self, other, contact) {
            var previous = _this.supportContacts.get(contact);
            if (_this.safety && previous != null && previous.upper.placed && previous.upper.supported && !previous.upper.lost) {
              _this.supportReturns.set(previous.upper.id + ":" + previous.lower.uuid, _extends({}, previous, {
                expires: _this.safetyTime + DETACH_GRACE_SECONDS
              }));
            }
            _this.supportContacts["delete"](contact);
            if (_this.safety) _this.refreshSupport();
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
            for (var _iterator2 = _createForOfIteratorHelperLoose(_this.pendingStabilizers), _step2; !(_step2 = _iterator2()).done;) {
              var _step2$value = _step2.value,
                _key = _step2$value[0],
                _pending = _step2$value[1];
              if (_pending.plank === record && _pending.contact === contact) _this.pendingStabilizers["delete"](_key);
            }
            if (active.size > 0) return;
            fixtureContacts["delete"](other);
            record.contacts["delete"](other);
            if (record.contacts.size === 0) body.angularDamping = freeAngularDamping + record.assistDamping;
          });
          collider.on(Contact2DType.PRE_SOLVE, function (_self, other, contact) {
            if (_this.rejectContact(record, other, contact)) return;
            _this.recordSupport(record, other, contact);
            _this.prepareCushion(record, other, contact);
            if (spec.adhesion) _this.prepareAdhesion(record, other, contact);
            if (spec.stabilizer) _this.prepareStabilizer(record, other, contact);
          });
          this.bodies.push(record);
          this.root.addChild(node);
          return record;
        }

        /** The controller freezes this normal-view boundary during an incident. Visual zoom never enters physics. */;
        _proto.configureSafety = function configureSafety(boundary, confirmedTop, assist) {
          if (assist === void 0) {
            assist = true;
          }
          this.safety = {
            boundary: _extends({}, boundary),
            confirmedTop: confirmedTop,
            assist: assist
          };
          this.refreshSupport();
        };
        _proto.beforePhysics = function beforePhysics() {
          if (!this.safety) return;
          this.safetyDt = Math.min(.1, Math.max(0, game.deltaTime));
          this.safetyTime += this.safetyDt;
          for (var _iterator3 = _createForOfIteratorHelperLoose(this.supportReturns), _step3; !(_step3 = _iterator3()).done;) {
            var _step3$value = _step3.value,
              key = _step3$value[0],
              relation = _step3$value[1];
            if (relation.expires < this.safetyTime) this.supportReturns["delete"](key);
          }
          this.refreshSupport();
          this.checkLosses();
          this.updateAssistance(this.safetyDt);
        }

        /** PRE_SOLVE may run several substeps before Cocos copies native transforms to Nodes. */;
        _proto.nativeBounds = function nativeBounds(record) {
          var p = record.body.getWorldPoint(new Vec2(), new Vec2());
          var axis = record.body.getWorldVector(new Vec2(1, 0), new Vec2());
          var bounds = localBounds(record.spec, Math.atan2(axis.y, axis.x) * 180 / Math.PI);
          return {
            left: p.x + bounds.left,
            right: p.x + bounds.right,
            bottom: p.y + bounds.bottom,
            top: p.y + bounds.top
          };
        };
        _proto.recordSupport = function recordSupport(record, other, contact) {
          if (other.sensor) return;
          var peer = this.bodies.find(function (candidate) {
            return candidate.collider === other;
          });
          var manifold = contact.getWorldManifold();
          var towardY = manifold.normal.y * (contact.colliderA === record.collider ? 1 : -1);
          this.supportContacts["delete"](contact);
          if (!manifold.points.length) return;
          if (towardY < -.3) this.supportContacts.set(contact, {
            upper: record,
            lower: other
          });else if (towardY > .3 && peer) this.supportContacts.set(contact, {
            upper: peer,
            lower: record.collider
          });
        }

        /** Directed contacts and finite local glue must ultimately reach the real ground. A floating pair is not a root. */;
        _proto.refreshSupport = function refreshSupport() {
          var _this$platform$body,
            _this2 = this;
          var supported = new Set();
          if (this.platform.enabledInHierarchy && (_this$platform$body = this.platform.body) != null && _this$platform$body.enabledInHierarchy) supported.add(this.platform);
          var edges = [];
          var active = function active(collider) {
            return collider.enabledInHierarchy && !_this2.bodies.some(function (record) {
              return record.collider === collider && record.lost;
            });
          };
          for (var _iterator4 = _createForOfIteratorHelperLoose(this.supportContacts.values()), _step4; !(_step4 = _iterator4()).done;) {
            var _step4$value = _step4.value,
              _upper = _step4$value.upper,
              _lower = _step4$value.lower;
            if (active(_upper.collider) && active(_lower)) edges.push({
              upper: _upper.collider,
              lower: _lower
            });
          }
          var connect = function connect(a, b) {
            if (!active(a) || !active(b)) return;
            edges.push({
              upper: a,
              lower: b
            }, {
              upper: b,
              lower: a
            });
          };
          for (var _iterator5 = _createForOfIteratorHelperLoose(this.bonds.values()), _step5; !(_step5 = _iterator5()).done;) {
            var bond = _step5.value;
            if (this.bondIntact(bond)) connect(bond.ball.collider, bond.other);
          }
          for (var _iterator6 = _createForOfIteratorHelperLoose(this.stabilizerBonds.values()), _step6; !(_step6 = _iterator6()).done;) {
            var _bond = _step6.value;
            var error = this.stabilizerError(_bond);
            if (error.distance <= Math.max(8, _bond.plank.spec.height * .5) && error.angle <= _bond.plank.spec.stabilizer.maxAngleError) connect(_bond.plank.collider, _bond.support.collider);
          }
          var changed = true;
          while (changed) {
            changed = false;
            for (var _iterator7 = _createForOfIteratorHelperLoose(edges), _step7; !(_step7 = _iterator7()).done;) {
              var _step7$value = _step7.value,
                upper = _step7$value.upper,
                lower = _step7$value.lower;
              if (!supported.has(upper) && supported.has(lower)) {
                supported.add(upper);
                changed = true;
              }
            }
          }
          for (var _iterator8 = _createForOfIteratorHelperLoose(this.bodies), _step8; !(_step8 = _iterator8()).done;) {
            var _record = _step8.value;
            _record.supported = !_record.lost && _record.collider.enabledInHierarchy && supported.has(_record.collider);
            // Help stops on actual detachment, independently of the loss grace timer.
            if (this.safety && (!_record.supported || _record.body.linearVelocity.y < FALL_SPEED)) this.setAssist(_record, 0);
          }
        };
        _proto.outside = function outside(record) {
          var edge = !record.placed && record.lossBoundary ? record.lossBoundary : this.safety.boundary;
          var bounds = this.nativeBounds(record);
          return {
            side: bounds.right < edge.left || bounds.left > edge.right,
            below: bounds.top < edge.bottom
          };
        };
        _proto.checkLoss = function checkLoss(record) {
          if (!this.safety || record.lost || !record.collider.enabledInHierarchy || record.body.type !== ERigidBody2DType.Dynamic) return;
          var outside = this.outside(record);
          if (outside.side || outside.below && (!record.placed || !record.supported && record.detachedSeconds >= DETACH_GRACE_SECONDS && record.fallingSeconds >= FALL_SECONDS)) this.markLost(record);
        };
        _proto.checkLosses = function checkLosses() {
          for (var _iterator9 = _createForOfIteratorHelperLoose(this.bodies), _step9; !(_step9 = _iterator9()).done;) {
            var _record2 = _step9.value;
            this.checkLoss(_record2);
          }
        };
        _proto.mayReturnToSupport = function mayReturnToSupport(record, other, contact) {
          if (!record.placed || record.lost || !other.body || !other.enabledInHierarchy) return false;
          var previous = this.supportReturns.get(record.id + ":" + other.uuid);
          if (!previous || previous.expires < this.safetyTime) return false;
          var lower = this.bodies.find(function (candidate) {
            return candidate.collider === other;
          });
          if (other !== this.platform && (!(lower != null && lower.supported) || lower.lost)) return false;
          if (other === this.platform && !other.body.enabledInHierarchy) return false;
          var relative = record.body.linearVelocity.clone().subtract(other.body.linearVelocity);
          if (relative.length() >= .4 || Math.abs(record.body.angularVelocity) >= .5 || Math.abs(other.body.angularVelocity) >= .5) return false;
          var manifold = contact.getWorldManifold();
          var towardY = manifold.normal.y * (contact.colliderA === record.collider ? 1 : -1);
          return manifold.points.length > 0 && towardY < -.3;
        };
        _proto.rejectContact = function rejectContact(record, other, contact) {
          var _this3 = this;
          var peer = this.bodies.find(function (candidate) {
            return candidate.collider === other;
          });
          if (this.safety) {
            // Refresh an existing edge's real normal before using it as evidence. Do not insert
            // a brand-new contact here: an external impact cannot certify its own support.
            if (this.supportContacts.has(contact)) this.recordSupport(record, other, contact);
            this.refreshSupport();
          }
          this.checkLoss(record);
          if (peer) this.checkLoss(peer);
          // An old, newly detached piece may still be in its loss grace interval. It cannot acquire
          // a fresh screen-external support or hit the lower tower while that interval is running.
          var isolated = function isolated(candidate, counterpart) {
            if (candidate.lost) return true;
            if (!_this3.safety || !candidate.collider.enabledInHierarchy) return false;
            var outside = _this3.outside(candidate);
            return outside.side || outside.below && !candidate.supported && !_this3.mayReturnToSupport(candidate, counterpart, contact);
          };
          if (contact.disabled || contact.disabledOnce || isolated(record, other) || peer && isolated(peer, record.collider)) {
            if (record.lost || peer != null && peer.lost) contact.disabled = true;else contact.disabledOnce = true;
            this.supportContacts["delete"](contact);
            if (this.safety) this.filteredContacts++;
            return true;
          }
          return false;
        };
        _proto.markLost = function markLost(record) {
          var _this$onLoss;
          if (record.lost || this.losing.has(record.id)) return;
          this.losing.add(record.id);
          // The controller snapshots the old-tower set with the actual pre-solve transforms here.
          (_this$onLoss = this.onLoss) == null || _this$onLoss.call(this, record);
          record.lost = true;
          record.supported = false;
          this.losing["delete"](record.id);
          this.setAssist(record, 0);
          // Disabling a collider or joint in PRE_SOLVE is deferred by Creator. Zero the existing
          // motors immediately as well; contact.disabled is the immediate collision barrier.
          for (var _iterator10 = _createForOfIteratorHelperLoose(this.bonds), _step10; !(_step10 = _iterator10()).done;) {
            var _step10$value = _step10.value,
              key = _step10$value[0],
              bond = _step10$value[1];
            if (bond.ball === record || bond.other === record.collider) {
              bond.joint.maxForce = 0;
              bond.joint.maxTorque = 0;
              this.removeBond(bond);
              this.bonds["delete"](key);
            }
          }
          for (var _iterator11 = _createForOfIteratorHelperLoose(this.stabilizerBonds), _step11; !(_step11 = _iterator11()).done;) {
            var _step11$value = _step11.value,
              _key2 = _step11$value[0],
              _bond2 = _step11$value[1];
            if (_bond2.plank === record || _bond2.support === record) {
              _bond2.joint.maxForce = 0;
              _bond2.joint.maxTorque = 0;
              this.removeBond(_bond2);
              this.stabilizerBonds["delete"](_key2);
              this.brokenStabilizers.add(_key2);
            }
          }
          for (var _iterator12 = _createForOfIteratorHelperLoose(this.supportContacts), _step12; !(_step12 = _iterator12()).done;) {
            var _step12$value = _step12.value,
              contact = _step12$value[0],
              edge = _step12$value[1];
            if (edge.upper === record || edge.lower === record.collider) this.supportContacts["delete"](contact);
          }
          for (var _iterator13 = _createForOfIteratorHelperLoose(this.supportReturns), _step13; !(_step13 = _iterator13()).done;) {
            var _step13$value = _step13.value,
              _key3 = _step13$value[0],
              relation = _step13$value[1];
            if (relation.upper === record || relation.lower === record.collider) this.supportReturns["delete"](_key3);
          }
          for (var _iterator14 = _createForOfIteratorHelperLoose(this.bodies), _step14; !(_step14 = _iterator14()).done;) {
            var peer = _step14.value;
            peer.contacts["delete"](record.collider);
          }
          record.contacts.clear();
          record.collider.enabled = false;
        };
        _proto.setAssist = function setAssist(record, value) {
          record.assistDamping = value;
          var base = record.contacts.size && !record.lost ? record.spec.contactAngularDamping : undefined;
          var damping = (base != null ? base : record.spec.circle ? .1 : 1.5) + value;
          // SetAngularDamping does not wake sleeping Box2D bodies. Never wake the deep tower for help.
          if (record.body.angularDamping !== damping) record.body.angularDamping = damping;
        };
        _proto.updateAssistance = function updateAssistance(dt) {
          if (!this.safety) return;
          var _this$safety = this.safety,
            boundary = _this$safety.boundary,
            confirmedTop = _this$safety.confirmedTop,
            assist = _this$safety.assist;
          var height = Math.max(1, boundary.top - boundary.bottom);
          for (var _iterator15 = _createForOfIteratorHelperLoose(this.bodies), _step15; !(_step15 = _iterator15()).done;) {
            var _record3 = _step15.value;
            if (!assist || _record3.lost || !_record3.placed || !_record3.supported || _record3.body.linearVelocity.y < FALL_SPEED) {
              this.setAssist(_record3, 0);
              continue;
            }
            var bounds = this.nativeBounds(_record3);
            var depth = Math.max(0, confirmedTop - bounds.top);
            var t = Math.max(0, Math.min(1, (depth - height) / (2 * height)));
            var target = bounds.top < boundary.bottom ? MAX_DEEP_ASSIST * t * t * (3 - 2 * t) : 0;
            this.setAssist(_record3, _record3.assistDamping + (target - _record3.assistDamping) * (1 - Math.exp(-8 * dt)));
          }
        };
        _proto.collapseTrend = function collapseTrend() {
          return this.bodies.filter(function (record) {
            return record.placed && !record.lost && !record.supported && record.detachedSeconds >= DETACH_GRACE_SECONDS && record.fallingSeconds >= FALL_SECONDS;
          }).length >= 2;
        };
        _proto.remainingStable = function remainingStable() {
          return this.bodies.every(function (record) {
            return record.lost || !record.collider.enabled || record.supported && record.body.linearVelocity.length() < .12 && Math.abs(record.body.angularVelocity) < .12;
          });
        };
        _proto.safetySnapshot = function safetySnapshot() {
          var _this$safety2, _this$safety3, _this$safety4;
          return {
            enabled: !!this.safety,
            boundary: (_this$safety2 = this.safety) == null ? void 0 : _this$safety2.boundary,
            confirmedTop: (_this$safety3 = this.safety) == null ? void 0 : _this$safety3.confirmedTop,
            assistanceEnabled: (_this$safety4 = this.safety) == null ? void 0 : _this$safety4.assist,
            maxAssistDamping: MAX_DEEP_ASSIST,
            filteredContacts: this.filteredContacts,
            pendingSupportReturns: this.supportReturns.size,
            detachGraceSeconds: DETACH_GRACE_SECONDS,
            fallSeconds: FALL_SECONDS,
            fallSpeed: FALL_SPEED,
            collapseTrend: this.collapseTrend(),
            remainingStable: this.remainingStable(),
            bodies: this.bodies.map(function (record) {
              return {
                id: record.id,
                lost: record.lost,
                supported: record.supported,
                detachedSeconds: record.detachedSeconds,
                fallingSeconds: record.fallingSeconds,
                assistDamping: record.assistDamping,
                angularDamping: record.body.angularDamping
              };
            })
          };
        };
        _proto.horizontal = function horizontal(record) {
          return Math.abs(Math.sin(planarAngle(record.node.rotation) * Math.PI / 180)) <= Math.sin(Math.PI / 12);
        };
        _proto.prepareCushion = function prepareCushion(record, other, contact) {
          var _incoming$spec$contac;
          if (!other.body || other.sensor) return;
          var manifold = contact.getWorldManifold();
          var normal = new Vec2(manifold.normal.x, manifold.normal.y);
          normal.multiplyScalar(contact.colliderA === record.collider ? 1 : -1);
          if (Math.abs(normal.y) < .7 || !manifold.points.length) return;
          var peer = this.bodies.find(function (candidate) {
            return candidate.collider === other;
          });
          var incoming = normal.y < 0 ? record : peer;
          var support = incoming === record ? peer : record;
          if (!incoming || incoming.placed || incoming.body.type !== ERigidBody2DType.Dynamic || this.cushionedBodies.has(incoming.id) || support && support.id > incoming.id) return;
          var supportBody = incoming === record ? other.body : record.body;
          var boardLimit = support != null && support.spec.stabilizer && this.horizontal(support) ? support.spec.stabilizer.maxImpactSpeed : undefined;
          var limit = Math.min((_incoming$spec$contac = incoming.spec.contactImpactSpeed) != null ? _incoming$spec$contac : Infinity, boardLimit != null ? boardLimit : Infinity);
          if (!Number.isFinite(limit)) return;
          if (incoming !== record) normal.multiplyScalar(-1);
          // Consume this one-time help only on a real lower support, never a side graze.
          this.cushionedBodies.add(incoming.id);
          this.cushionImpact(incoming.body, supportBody, manifold.points[0], normal, limit);
        };
        _proto.prepareStabilizer = function prepareStabilizer(plank, other, contact) {
          var support = this.bodies.find(function (record) {
            return record.collider === other;
          });
          if (!support) return; // Never attach the plank to the static ground.
          var key = plank.id + ":" + support.id;
          if (this.brokenStabilizers.has(key) || this.stabilizerBonds.has(key) || this.pendingStabilizers.has(key)) return;
          var pending = {
            plank: plank,
            support: support,
            contact: contact
          };
          if (this.validStabilizerContact(pending)) this.pendingStabilizers.set(key, pending);
        };
        _proto.validStabilizerContact = function validStabilizerContact(_ref2) {
          var plank = _ref2.plank,
            support = _ref2.support,
            contact = _ref2.contact;
          if (!plank.collider.enabledInHierarchy || !support.collider.enabledInHierarchy || support.collider.sensor || plank.body.type !== ERigidBody2DType.Dynamic || support.body.type !== ERigidBody2DType.Dynamic || support.id >= plank.id || !plank.contacts.has(support.collider) || !this.horizontal(plank)) return false;
          var manifold = contact.getWorldManifold();
          var towardY = manifold.normal.y * (contact.colliderA === plank.collider ? 1 : -1);
          return towardY < -.7 && manifold.points.some(function (point) {
            return point.y <= plank.node.worldPosition.y;
          });
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
          var _this4 = this;
          for (var _iterator16 = _createForOfIteratorHelperLoose(this.bonds), _step16; !(_step16 = _iterator16()).done;) {
            var _step16$value = _step16.value,
              key = _step16$value[0],
              bond = _step16$value[1];
            if (!this.bondIntact(bond)) {
              this.removeBond(bond);
              this.bonds["delete"](key);
            }
          }
          for (var _iterator17 = _createForOfIteratorHelperLoose(this.pendingAdhesion), _step17; !(_step17 = _iterator17()).done;) {
            var _step17$value = _step17.value,
              _key4 = _step17$value[0],
              pending = _step17$value[1];
            if (pending.ball.contacts.has(pending.other) && pending.other.enabledInHierarchy) {
              this.bonds.set(_key4, this.attach(pending));
            }
          }
          this.pendingAdhesion.clear();
          for (var _iterator18 = _createForOfIteratorHelperLoose(this.stabilizerBonds), _step18; !(_step18 = _iterator18()).done;) {
            var _step18$value = _step18.value,
              _key5 = _step18$value[0],
              _bond3 = _step18$value[1];
            var error = this.stabilizerError(_bond3);
            if (!_bond3.plank.collider.enabledInHierarchy || !_bond3.support.collider.enabledInHierarchy || error.distance > Math.max(8, _bond3.plank.spec.height * .5) || error.angle > _bond3.plank.spec.stabilizer.maxAngleError) {
              this.removeBond(_bond3);
              this.stabilizerBonds["delete"](_key5);
              this.brokenStabilizers.add(_key5);
            }
          }
          var _loop = function _loop() {
            var _step19$value = _step19.value,
              key = _step19$value[0],
              pending = _step19$value[1];
            var count = Array.from(_this4.stabilizerBonds.values()).filter(function (bond) {
              return bond.plank === pending.plank;
            }).length;
            if (count < 2 && !_this4.brokenStabilizers.has(key) && _this4.validStabilizerContact(pending)) {
              _this4.stabilizerBonds.set(key, _this4.attachStabilizer(pending));
            }
          };
          for (var _iterator19 = _createForOfIteratorHelperLoose(this.pendingStabilizers), _step19; !(_step19 = _iterator19()).done;) {
            _loop();
          }
          this.pendingStabilizers.clear();
          if (this.safety) {
            this.refreshSupport();
            for (var _iterator20 = _createForOfIteratorHelperLoose(this.bodies), _step20; !(_step20 = _iterator20()).done;) {
              var _record4 = _step20.value;
              if (_record4.lost || !_record4.collider.enabled || _record4.body.type !== ERigidBody2DType.Dynamic) continue;
              _record4.detachedSeconds = _record4.supported ? 0 : _record4.detachedSeconds + this.safetyDt;
              _record4.fallingSeconds = _record4.body.linearVelocity.y < FALL_SPEED ? _record4.fallingSeconds + this.safetyDt : 0;
            }
            this.checkLosses();
            this.refreshSupport();
          }
          // The solver and deferred joint removal have finished. Remove lost nodes from the
          // active scene/physics now; keep their records readable until the scene is destroyed.
          for (var _iterator21 = _createForOfIteratorHelperLoose(this.bodies), _step21; !(_step21 = _iterator21()).done;) {
            var _record5 = _step21.value;
            if (_record5.lost && _record5.node.active) _record5.node.active = false;
          }
        };
        _proto.attachStabilizer = function attachStabilizer(_ref3) {
          var plank = _ref3.plank,
            support = _ref3.support,
            contact = _ref3.contact;
          var spec = plank.spec.stabilizer;
          var offset = contactOffset(support.body, plank.body, support.collider, contact);
          var angle = relativeBodyAngle(support.body, plank.body);
          var joint = support.node.addComponent(RelativeJoint2D);
          joint.connectedBody = plank.body;
          joint.autoCalcOffset = false;
          joint.linearOffset = offset;
          joint.angularOffset = angle;
          // Fixed half-budget per support: adding a second support never exceeds the board's budget.
          // Resist relative speed within that budget. Position feedback fought contact resolution
          // under later loads; zero feedback neither pulls back a pose nor levels the board.
          joint.maxForce = spec.maxForce / 2;
          joint.maxTorque = spec.maxTorque / 2;
          joint.correctionFactor = 0;
          joint.collideConnected = true;
          joint.apply();
          return {
            plank: plank,
            support: support,
            joint: joint,
            offset: offset,
            angle: angle
          };
        };
        _proto.stabilizerError = function stabilizerError(bond) {
          var offset = bond.support.body.getLocalPoint(bond.plank.body.getWorldPoint(new Vec2(), new Vec2()), new Vec2());
          var relative = planarAngle(bond.plank.node.rotation) - planarAngle(bond.support.node.rotation);
          return {
            distance: Vec2.distance(offset, bond.offset),
            angle: Math.abs(wrapAngle(relative - bond.angle))
          };
        };
        _proto.stabilizerSnapshot = function stabilizerSnapshot() {
          var _this5 = this;
          return {
            active: Array.from(this.stabilizerBonds.values()).map(function (bond) {
              return _extends({
                plankId: bond.plank.id,
                supportId: bond.support.id
              }, _this5.stabilizerError(bond), {
                maxForce: bond.joint.maxForce,
                maxTorque: bond.joint.maxTorque
              });
            }),
            brokenPairs: Array.from(this.brokenStabilizers)
          };
        };
        _proto.attach = function attach(contact) {
          var ball = contact.ball,
            other = contact.other,
            side = contact.side;
          var base = side < 0 ? other.body : ball.body;
          var attached = side < 0 ? ball.body : other.body;
          var offset = contactOffset(base, attached, side < 0 ? other : ball.collider, contact.contact);
          var joint = base.node.addComponent(RelativeJoint2D);
          joint.connectedBody = attached;
          joint.autoCalcOffset = false;
          // Cocos auto offsets use world deltas. Explicit local offsets preserve rotated supports.
          joint.linearOffset = offset;
          joint.angularOffset = relativeBodyAngle(base, attached);
          joint.maxForce = ball.spec.adhesion.maxForce;
          joint.maxTorque = ball.spec.adhesion.maxTorque;
          // Finite resistance to relative motion, without positional feedback oscillation.
          joint.correctionFactor = 0;
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
          if (record.lost) return;
          record.body.type = ERigidBody2DType.Dynamic;
          record.body.linearVelocity = new Vec2();
          record.body.angularVelocity = 0;
          record.collider.enabled = true;
          record.collider.apply();
          record.body.wakeUp();
        };
        _proto.isStable = function isStable() {
          var _this6 = this;
          return this.bodies.every(function (_ref4) {
            var body = _ref4.body,
              collider = _ref4.collider,
              contacts = _ref4.contacts,
              lost = _ref4.lost,
              supported = _ref4.supported;
            return lost || !collider.enabled || (_this6.safety ? supported : contacts.size > 0) && body.linearVelocity.length() < .12 && Math.abs(body.angularVelocity) < .12;
          });
        }

        /** Generous handoff gate, separate from the strict stable-score threshold. */;
        _proto.hasPlacementHazard = function hasPlacementHazard() {
          var _this7 = this;
          return this.bodies.some(function (_ref5) {
            var body = _ref5.body,
              collider = _ref5.collider,
              contacts = _ref5.contacts,
              contactSeconds = _ref5.contactSeconds,
              lost = _ref5.lost,
              supported = _ref5.supported;
            if (lost || !collider.enabled || contactSeconds === null) return false;
            return body.linearVelocity.y < -.75 || Math.abs(body.angularVelocity) > 1.5 || (_this7.safety ? !supported : contacts.size === 0) && body.linearVelocity.y < -.12;
          });
        }

        /** Include every attached surface that handoff permits, including horizontal sliding. */;
        _proto.placementTop = function placementTop() {
          var _this8 = this;
          return Math.max.apply(Math, [0].concat(this.bodies.filter(function (_ref6) {
            var body = _ref6.body,
              collider = _ref6.collider,
              contacts = _ref6.contacts,
              lost = _ref6.lost,
              supported = _ref6.supported;
            return !lost && collider.enabled && (_this8.safety ? supported : contacts.size > 0) && body.linearVelocity.y >= -.75 && Math.abs(body.angularVelocity) <= 1.5;
          }).map(function (record) {
            return _this8.bounds(record).top;
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
          var _this9 = this;
          return Math.max.apply(Math, [0].concat(this.bodies.filter(function (r) {
            return r.placed && !r.lost;
          }).map(function (r) {
            return _this9.bounds(r).top;
          })));
        };
        _proto.dispose = function dispose() {
          director.off(Director.EVENT_BEFORE_PHYSICS, this.beforePhysics, this);
          director.off(Director.EVENT_AFTER_PHYSICS, this.afterPhysics, this);
          this.supportContacts.clear();
          this.supportReturns.clear();
          this.losing.clear();
          this.pendingAdhesion.clear();
          for (var _iterator22 = _createForOfIteratorHelperLoose(this.bonds.values()), _step22; !(_step22 = _iterator22()).done;) {
            var bond = _step22.value;
            this.removeBond(bond);
          }
          this.bonds.clear();
          this.pendingStabilizers.clear();
          for (var _iterator23 = _createForOfIteratorHelperLoose(this.stabilizerBonds.values()), _step23; !(_step23 = _iterator23()).done;) {
            var _bond4 = _step23.value;
            this.removeBond(_bond4);
          }
          this.stabilizerBonds.clear();
          this.brokenStabilizers.clear();
          this.cushionedBodies.clear();
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