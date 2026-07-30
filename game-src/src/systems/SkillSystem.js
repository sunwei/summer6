// This file remembers which crystals and martial skills XiaoBei has collected.
import { ITEMS } from '../constants.js';
import { bus, EVENTS } from '../events.js';

export class SkillSystem {
  constructor() {
    this.inventory = {
      [ITEMS.CRYSTAL_ZHUQUE]: true,
      [ITEMS.CRYSTAL_HUANGLONG]: false,
      [ITEMS.CRYSTAL_BAIHU]: false,
      [ITEMS.CRYSTAL_XUANWU]: true,   // 已从南岳衡山获得玄武护体
      [ITEMS.CRYSTAL_QINGLONG]: false,
      [ITEMS.SKILL_TAIJI]: false,
      [ITEMS.SKILL_YIJINJING]: false,
      [ITEMS.TAIJI_SWORD]: false,
      [ITEMS.CHAN_STAFF]: false,
      [ITEMS.XUANWU_BLADE]: false,
      [ITEMS.SONGSHAN_COMPLETE]: false,
      [ITEMS.HUASHAN_COMPLETE]: false,
      [ITEMS.HENGSHAN_COMPLETE]: false,
      [ITEMS.TAISHAN_COMPLETE]: false,
    };
    this.coins = 0;
  }

  collect(itemKey) {
    if (!Object.prototype.hasOwnProperty.call(this.inventory, itemKey)) {
      return false;
    }

    if (this.inventory[itemKey]) {
      return false;
    }

    this.inventory[itemKey] = true;
    bus.emit(EVENTS.ITEM_COLLECTED, {
      itemKey,
      inventory: this.getInventory(),
    });
    return true;
  }

  addCoins(amount) {
    this.coins += amount;
    bus.emit(EVENTS.COINS_UPDATED, { coins: this.coins });
  }

  spendCoins(amount) {
    if (this.coins < amount) return false;
    this.coins -= amount;
    bus.emit(EVENTS.COINS_UPDATED, { coins: this.coins });
    return true;
  }

  getCoins() {
    return this.coins;
  }

  hasAll() {
    return Object.values(this.inventory).every(Boolean);
  }

  getInventory() {
    return { ...this.inventory };
  }
}

export const skillSystem = new SkillSystem();
