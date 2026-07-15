// This file creates the Phaser game and registers every scene.
import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, GRAVITY } from './constants.js';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { HUDScene } from './scenes/HUDScene.js';
import { WudangScene } from './scenes/WudangScene.js';
import { SongshanScene } from './scenes/SongshanScene.js';
import { HuashanScene } from './scenes/HuashanScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#000000',
  pixelArt: true,
  render: {
    antialias: false,
    roundPixels: true,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: GRAVITY },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, WudangScene, SongshanScene, HuashanScene, HUDScene],
};

window.addEventListener('load', () => {
  new Phaser.Game(config);
});
