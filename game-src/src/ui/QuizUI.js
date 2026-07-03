// QuizUI.js — Shows a multiple-choice question panel. Keyboard 1-4 or A-D to answer.
import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../constants.js';
import { sfx } from '../systems/SoundFX.js';

export class QuizUI {
  constructor(scene) {
    this.scene = scene;
    this.isOpen = false;
    this.onAnswer = null;
    this._keyHandler = this._handleKey.bind(this);
    this._buildUI();
  }

  _buildUI() {
    const PLAY_H = GAME_HEIGHT - 80; // 460 — visible game viewport height
    const W = GAME_WIDTH * 0.82;
    const H = 280;
    const cx = GAME_WIDTH / 2;
    const cy = PLAY_H / 2; // 230 — true center of play area

    const top = cy - H / 2; // y=90

    this.bg = this.scene.add
      .rectangle(cx, cy, W, H, 0x04080f, 0.93)
      .setStrokeStyle(2, COLORS.GOLD, 1)
      .setScrollFactor(0)
      .setDepth(1300)
      .setVisible(false);

    this.titleText = this.scene.add
      .text(cx, top + 20, '📜 智慧问答', {
        fontSize: '18px', color: '#ffd700', fontStyle: 'bold',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0).setDepth(1301).setVisible(false);

    this.questionText = this.scene.add
      .text(cx, top + 52, '', {
        fontSize: '17px', color: '#eef2ff',
        wordWrap: { width: W - 48 }, align: 'center',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0).setDepth(1301).setVisible(false);

    this.choiceTexts = [];
    const choiceColors = ['#a8e6ff', '#ffe0a8', '#b8ffb8', '#ffb8d8'];
    const labels = ['1  ', '2  ', '3  ', '4  '];
    const choiceStartY = top + 128; // fixed start, below question area
    for (let i = 0; i < 4; i += 1) {
      const t = this.scene.add
        .text(cx - W / 2 + 28, choiceStartY + i * 32, '', {
          fontSize: '16px', color: choiceColors[i],
        })
        .setOrigin(0, 0.5)
        .setScrollFactor(0).setDepth(1301).setVisible(false);
      t._label = labels[i];
      this.choiceTexts.push(t);
    }

    this.resultText = this.scene.add
      .text(cx, top + H - 22, '', {
        fontSize: '18px', fontStyle: 'bold', color: '#ffffff',
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0).setDepth(1302).setVisible(false);

    this._all = [this.bg, this.titleText, this.questionText, this.resultText, ...this.choiceTexts];
  }

  open(question, choices, correctIndex, onAnswer) {
    if (this.isOpen) return;
    this.isOpen = true;
    this.answered = false;
    this.correctIndex = correctIndex;
    this.onAnswer = onAnswer;

    this.questionText.setText(question);
    this.choiceTexts.forEach((t, i) => t.setText(t._label + choices[i]));
    this.choiceTexts.forEach((t, i) => t.setColor(['#a8e6ff', '#ffe0a8', '#b8ffb8', '#ffb8d8'][i]));
    this.resultText.setText('').setColor('#ffffff');

    this._all.forEach((o) => o.setVisible(true));
    sfx.play('quiz_open');
    this.scene.input.keyboard.on('keydown', this._keyHandler);
  }

  _handleKey(evt) {
    if (!this.isOpen || this.answered) return;
    const map = {
      Digit1: 0,
      Digit2: 1,
      Digit3: 2,
      Digit4: 3,
      KeyA: 0,
      KeyB: 1,
      KeyC: 2,
      KeyD: 3,
    };
    const idx = map[evt.code];
    if (idx === undefined) return;

    this.answered = true;
    const correct = idx === this.correctIndex;

    if (correct) {
      sfx.play('quiz_correct');
      this.resultText.setText('✅ 答对了！+20 智慧').setColor('#7fff7f');
      this.choiceTexts[idx].setColor('#7fff7f');
    } else {
      sfx.play('quiz_wrong');
      this.resultText.setText(`❌ 再想想！正确答案是 ${['A', 'B', 'C', 'D'][this.correctIndex]}`).setColor('#ff8888');
      this.choiceTexts[idx].setColor('#ff6666');
      this.choiceTexts[this.correctIndex].setColor('#7fff7f');
    }

    this.scene.time.delayedCall(1800, () => {
      this.close();
      if (this.onAnswer) this.onAnswer(correct);
    });
  }

  close() {
    this.isOpen = false;
    this._all.forEach((o) => o.setVisible(false));
    this.scene.input.keyboard.off('keydown', this._keyHandler);
  }

  destroy() {
    this.close();
    this._all.forEach((o) => o.destroy());
  }
}
