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
      [ITEMS.SONGSHAN_COMPLETE]: false,
    };
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

  hasAll() {
    return Object.values(this.inventory).every(Boolean);
  }

  getInventory() {
    return { ...this.inventory };
  }
}

export const skillSystem = new SkillSystem();
