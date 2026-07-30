// This file provides a tiny global event bus so scenes can talk to each other.
class EventBus extends EventTarget {
  constructor() {
    super();
    this.handlerMap = new WeakMap();
  }

  emit(event, detail = {}) {
    this.dispatchEvent(new CustomEvent(event, { detail }));
  }

  on(event, handler) {
    const wrapped = (e) => handler(e.detail);

    if (!this.handlerMap.has(handler)) {
      this.handlerMap.set(handler, new Map());
    }

    this.handlerMap.get(handler).set(event, wrapped);
    this.addEventListener(event, wrapped);
  }

  off(event, handler) {
    const wrapped = this.handlerMap.get(handler)?.get(event);

    if (wrapped) {
      this.removeEventListener(event, wrapped);
      this.handlerMap.get(handler).delete(event);
    }
  }
}

export const bus = new EventBus();
export const EVENTS = {
  ITEM_COLLECTED: 'item_collected',
  SKILL_ACTIVATED: 'skill_activated',
  SKILL_COOLDOWN: 'skill_cooldown',   // { itemKey, duration } — triggers hotbar cooldown overlay
  DIALOGUE_START: 'dialogue_start',
  DIALOGUE_END: 'dialogue_end',
  PLAYER_HURT: 'player_hurt',
  CRYSTAL_SKILL: 'crystal_skill',
  LEVEL_COMPLETE: 'level_complete',
  COINS_UPDATED: 'coins_updated',     // { coins } — emitted when coin total changes
};
