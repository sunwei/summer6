// This file creates the dialogue window with typewriter text and F-to-continue controls.
import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../constants.js';

export class DialogueBox {
  constructor(scene) {
    this.scene = scene;
    this.lines = [];
    this.currentIndex = 0;
    this.isOpen = false;
    this.isTyping = false;
    this.onComplete = null;
    this.typeEvent = null;

    this.createUI();
    this.scene.input.keyboard.on('keydown-F', this.handleAdvance, this);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.input.keyboard.off('keydown-F', this.handleAdvance, this);
    });
  }

  createUI() {
    const width = GAME_WIDTH * 0.8;
    const height = 120;
    const x = GAME_WIDTH / 2;
    const y = GAME_HEIGHT - 92;

    const bg = this.scene.add
      .rectangle(x, y, width, height, 0x05070c, 0.86)
      .setStrokeStyle(2, COLORS.UI_BORDER, 0.9)
      .setScrollFactor(0);
    const nameText = this.scene.add
      .text(x - width / 2 + 18, y - 48, '旁白', {
        fontSize: '22px',
        color: '#ffd700',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0);
    const bodyText = this.scene.add
      .text(x - width / 2 + 18, y - 18, '', {
        fontSize: '22px',
        color: '#f4f6ff',
        wordWrap: { width: width - 36 },
        lineSpacing: 8,
      })
      .setOrigin(0, 0)
      .setScrollFactor(0);
    const promptText = this.scene.add
      .text(x + width / 2 - 18, y + 40, '▶ 按F继续', {
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(1, 0.5)
      .setScrollFactor(0);

    this.container = this.scene.add.container(0, 0, [bg, nameText, bodyText, promptText]).setDepth(1200);
    this.container.setVisible(false);

    this.nameText = nameText;
    this.bodyText = bodyText;
    this.promptText = promptText;

    this.scene.tweens.add({
      targets: this.promptText,
      alpha: { from: 0.25, to: 1 },
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
  }

  start(lines, onComplete) {
    this.lines = [...lines];
    this.currentIndex = 0;
    this.onComplete = onComplete;
    this.isOpen = true;
    this.container.setVisible(true);
    this.showCurrentLine();
  }

  handleAdvance() {
    if (!this.isOpen) {
      return;
    }

    if (this.isTyping) {
      this.finishTyping();
      return;
    }

    if (this.currentIndex < this.lines.length - 1) {
      this.currentIndex += 1;
      this.showCurrentLine();
      return;
    }

    this.close();
    if (this.onComplete) {
      this.onComplete();
    }
  }

  showCurrentLine() {
    const { speaker, body } = this.parseLine(this.lines[this.currentIndex]);

    this.nameText.setText(speaker);
    this.bodyText.setText('');
    this.promptText.setVisible(false);
    this.isTyping = true;

    if (this.typeEvent) {
      this.typeEvent.remove(false);
    }

    let charIndex = 0;
    this.typeEvent = this.scene.time.addEvent({
      delay: 30,
      repeat: Math.max(body.length - 1, 0),
      callback: () => {
        charIndex += 1;
        this.bodyText.setText(body.slice(0, charIndex));

        if (charIndex >= body.length) {
          this.finishTyping();
        }
      },
    });

    if (body.length === 0) {
      this.finishTyping();
    }
  }

  finishTyping() {
    const { body } = this.parseLine(this.lines[this.currentIndex]);

    if (this.typeEvent) {
      this.typeEvent.remove(false);
      this.typeEvent = null;
    }

    this.bodyText.setText(body);
    this.isTyping = false;
    this.promptText.setVisible(true);
  }

  parseLine(line) {
    const match = line.match(/^(.+?)：「(.*)」$/);

    if (match) {
      return { speaker: match[1], body: match[2] };
    }

    if (line.startsWith('✅')) {
      return { speaker: '系统', body: line };
    }

    return { speaker: '旁白', body: line };
  }

  close() {
    this.isOpen = false;
    this.isTyping = false;
    this.container.setVisible(false);
    this.bodyText.setText('');

    if (this.typeEvent) {
      this.typeEvent.remove(false);
      this.typeEvent = null;
    }
  }
}
