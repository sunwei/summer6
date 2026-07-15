// This file defines the friendly Taoist NPC who teaches XiaoBei a new skill.
import * as Phaser from 'phaser';
import { DialogueBox } from '../ui/DialogueBox.js';
import { bus, EVENTS } from '../events.js';

export class NPC extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, texture, dialogues, onComplete, name = '武当真人') {
    super(scene, x, y, texture);

    this.scene = scene;
    this.dialogues = dialogues;
    this.onComplete = onComplete;
    this.npcName = name;
    this.interactionRadius = 60;
    this.complete = false;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setAllowGravity(false);
    this.body.setImmovable(true);

    this.nameLabel = scene.add
      .text(x, y - 54, this.npcName, {
        fontSize: '16px',
        color: '#fff4c4',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    this.hintLabel = scene.add
      .text(x, y - 76, '按 F 交谈', {
        fontSize: '15px',
        color: '#ffffff',
        backgroundColor: '#00000088',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.doneLabel = scene.add
      .text(x, y - 88, '✅', { fontSize: '24px' })
      .setOrigin(0.5)
      .setVisible(false);

    this.dialogueBox = new DialogueBox(scene);

    scene.tweens.add({
      targets: this.doneLabel,
      y: y - 96,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  setCompleted(value = true) {
    this.complete = value;
    this.doneLabel.setVisible(value);
    this.hintLabel.setVisible(false);
  }

  update(player) {
    this.nameLabel.setPosition(this.x, this.y - 54);
    this.hintLabel.setPosition(this.x, this.y - 76);
    this.doneLabel.setPosition(this.x, this.doneLabel.y);

    if (this.complete || player.isTalking) {
      this.hintLabel.setVisible(false);
      return false;
    }

    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    const near = distance <= this.interactionRadius;

    this.hintLabel.setVisible(near);

    if (near && (Phaser.Input.Keyboard.JustDown(player.keys.interact) || Phaser.Input.Keyboard.JustDown(player.keys.interactAlt))) {
      this.startDialogue(player);
    }

    return near;
  }

  startDialogue(player) {
    if (this.complete) {
      return;
    }

    player.isTalking = true;
    player.setVelocityX(0);
    bus.emit(EVENTS.DIALOGUE_START, { npc: this.npcName });

    this.dialogueBox.start(this.dialogues, () => {
      player.isTalking = false;
      this.setCompleted(true);
      bus.emit(EVENTS.DIALOGUE_END, { npc: this.npcName });

      if (this.onComplete) {
        this.onComplete();
      }
    });
  }
}
