# Blockduino

**Block-based Arduino coding for elementary and middle school students.**

Blockduino is a desktop app (Electron + [Blockly](https://developers.google.com/blockly)) for programming an Arduino Uno by snapping blocks together. It shows the Arduino C++ code the blocks generate and draws a wiring diagram for every part you use. One click compiles the program and uploads it to the board. The Arduino toolchain is bundled with the app, so it works offline in a classroom.

The interface is available in **English** (default) and **Korean (한국어)**. You can switch languages from the toolbar at any time.

## Features

- **Kid-friendly blocks:** start/loop, wait, LEDs, buttons, buzzer notes and melodies, analog I/O, sensors, servo motors, an I2C LCD, logic, loops, math and variables.
- **Live code preview:** the generated Arduino sketch updates as you edit the blocks.
- **Automatic wiring diagrams:** each part block draws an Uno + breadboard diagram using the pins chosen in the blocks.
- **One-click upload:** compiles and uploads with a bundled `arduino-cli`, and finds Arduino and compatible boards (CH340, FTDI, CP210x and native USB).
- **Sensor monitor:** a toggle adds serial output for every sensor block and streams the values into the app, so students can check that their sensors work.
- **Example projects with practice mode:** six examples (Night Light, Automatic Door and Fire Alarm, two levels each) open as a scrambled puzzle. Every block is detached and every value is wrong, so students have to put the program together themselves. Teachers can reveal the answer with an admin password.
- **Friendly error messages:** upload and compile failures are explained in plain language. The raw compiler log is one click away.
- **Projects** are saved as `.bdn` files (Blockly JSON).

### Supported hardware

| Part | Notes |
| --- | --- |
| Arduino Uno (and compatible clones) | FQBN `arduino:avr:uno` |
| LEDs, push buttons, piezo buzzer | buttons use `INPUT_PULLUP` (wire between the pin and GND) |
| HC-SR04 ultrasonic sensor | distance in cm |
| DHT11 temperature/humidity sensor | Adafruit DHT library |
| CDS photoresistor (light sensor) | analog pins A0–A5 with a 10 kΩ resistor |
| SG90 servo motor | PWM pins 3, 5, 6, 9, 10, 11 |
| 16x2 I2C LCD | address `0x27`, SDA = A4, SCL = A5 |

## Getting started (development)

Requirements: **Node.js 20+** and npm.

```bash
npm ci                    # install dependencies
npm run prepare-arduino   # download arduino-cli, the AVR core and libraries into vendor/
npm start                 # launch the app
```

`prepare-arduino` downloads a platform-specific toolchain into `vendor/arduino/<platform>/`. It currently supports **Windows (x64)** and **macOS (Apple Silicon)**. You can point the app at another toolchain folder with the `BLOCKDUINO_ARDUINO_DIR` environment variable.

Run the tests with:

```bash
npm test
```

## Building the Windows installer

The installer is an NSIS `.exe` built with electron-builder, and it bundles the Windows Arduino toolchain.

- **On GitHub:** the [`Build Windows Installer`](.github/workflows/build-windows.yml) workflow runs the tests, prepares the toolchain on a Windows runner and uploads the installer as a build artifact. It runs on pushes and pull requests, and you can also start it by hand from the Actions tab.
- **Locally on Windows:**

  ```bash
  npm ci
  npm run prepare-arduino
  npm run dist
  ```

  The installer is written to `dist/`.

The installer is not code-signed, so Windows SmartScreen may show a warning the first time it runs.

## Classroom notes

- **Answer password:** the **Show answer** button asks for an admin password, which is `0000` by default. Change `ANSWER_PASSWORD` in [`src/renderer/renderer.js`](src/renderer/renderer.js) before building the installer you hand out. It only stops students from peeking casually; it is not a security feature.
- **No port shows up on Windows?** Many clone boards use a CH340 USB chip and need the CH340 driver. The app shows this hint when an upload fails and no ports are detected.
- **LCD text:** the common I2C LCD modules can only display ASCII characters.

## Languages

The app starts in English. Pick **🌐 English / 한국어** in the toolbar to switch. The choice is remembered on that computer, and switching keeps your current blocks.

Strings live in [`src/shared/locales/`](src/shared/locales/):

- `ui`: interface text, looked up with `t('key', { params })`
- `blocks`: block labels, referenced from block definitions as `%{BKY_BD_*}`
- `examples`, `variables`: example titles and example variable names

To add a language:

1. Copy `en.js` to `<code>.js` and translate it. `tests/i18n.test.js` checks that every locale has the same keys and placeholders.
2. Register it in `LOCALES` and `LANGUAGES` in [`src/shared/i18n.js`](src/shared/i18n.js).
3. Add the matching Blockly core messages (`blockly/msg/<code>`) to `BLOCKLY_LOCALES` in [`src/renderer/renderer.js`](src/renderer/renderer.js).

## Project structure

```
src/
  main/              Electron main process
    main.js          window setup
    ipc.js           file dialogs, ports, upload and serial monitor IPC
    arduino.js       arduino-cli wrapper (board list, compile/upload, monitor)
    messages.js      student-friendly error messages
  renderer/          UI (Blockly workspace, toolbar, wiring panel)
  shared/
    blocks/          custom block definitions + Arduino code generators
    locales/         en / ko strings
    arduino-generator.js
    examples.js      example projects and practice-mode scrambling
    i18n.js
scripts/
  prepare-arduino.mjs  downloads the Arduino toolchain into vendor/
tests/               Vitest unit tests (code generation, examples, i18n, ports)
```
