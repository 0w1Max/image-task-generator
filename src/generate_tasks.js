const { createCanvas, loadImage } = require('canvas');
const fs = require('fs').promises;
const path = require('path');
const Prism = require('prismjs');

// Загрузка конфигурации из config.json
const configPath = path.join(__dirname, 'config.json');
let config;

async function loadConfig() {
    try {
        const configData = await fs.readFile(configPath, 'utf-8');
        config = JSON.parse(configData);
        console.log("Конфигурация успешно загружена из config.json");
    } catch (error) {
        console.error("Ошибка при чтении или парсинге файла конфигурации:", error);
        process.exit(1);
    }
}

// Функция для проверки существования файла
async function fileExists(filePath) {
    try {
        await fs.access(filePath, fs.constants.F_OK);
        return true;
    } catch (error) {
        console.log(`Файл не найден: ${filePath}`, error);
        return false;
    }
}

// Функция для обертывания текста
function wrapText(text, ctx, maxWidth) {
    try {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        for (const word of words) {
            let testLine = currentLine ? `${currentLine} ${word}` : word;
            const textMetrics = ctx.measureText(testLine);
            const testWidth = textMetrics.width;
            if (testWidth > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        lines.push(currentLine);
        return lines;
    } catch (error) {
        console.error("Ошибка при обертывании текста:", text, error);
        return [];
    }
}

// Функция для извлечения текста из токенов Prism
function extractTextFromToken(part) {
    try {
        if (typeof part === 'string') {
            return part;
        } else if (part && part.content) {
            if (Array.isArray(part.content)) {
                return part.content.map(extractTextFromToken).join('');
            } else if (typeof part.content === 'string') {
                return part.content;
            } else if (typeof part.content === 'object') {
                return extractTextFromToken(part.content);
            }
        }
        return '';
    } catch (error) {
        console.error("Ошибка при извлечении текста из токена:", part, error);
        return '';
    }
}

// Функция для рисования блока кода
function drawCodeBlock(ctx, code, x, y, maxWidth, fontSettings, language, maxCodeHeight) {
    try {
        if (!language || !Prism.languages[language]) {
            console.error("Неподдерживаемый язык программирования:", language);
            return 0;
        }
        const {
            codeFontFamily,
            codeSize,
            codeBackgroundColor,
            codeTextColor,
            codePadding,
            codeBorderRadius,
            codeBorderColor,
            codeHighlightColors,
        } = fontSettings;
        ctx.font = `${codeSize}px ${codeFontFamily}`;
        ctx.fillStyle = codeBackgroundColor;

        const lineHeight = codeSize + 5;
        const lines = code.split('\n');
        let currentY = y + codePadding + lineHeight;
        let renderedLines = 0;
        let lineHeights = [];
        let textBlockWidth = 0;


          for (const line of lines) {
            let currentX = x + codePadding;
            try {
                const parts = Prism.tokenize(line, Prism.languages[language]);
                let maxHeightOfLine = 0;

                for (const part of parts) {
                  const textPart = extractTextFromToken(part);
                  const textMetrics = ctx.measureText(textPart);
                  maxHeightOfLine = Math.max(maxHeightOfLine, textMetrics.actualBoundingBoxAscent + textMetrics.actualBoundingBoxDescent)
                   currentX += textMetrics.width;
                   if (currentX > x + maxWidth) {
                     currentX = x + codePadding;
                     currentY += lineHeight;
                    }
                }

                textBlockWidth = Math.max(textBlockWidth, currentX)
                 if (renderedLines < Math.floor(maxCodeHeight / lineHeight)) {
                   lineHeights.push(maxHeightOfLine)
                    currentY += lineHeight;
                   renderedLines++;
                  }
            }  catch (e){
                console.error("Ошибка при подсветке синтаксиса", e)
                textBlockWidth = maxWidth;
            }
          }
        const blockHeight = lineHeights.reduce((acc, cur) => acc + lineHeight, 0) + 2 * codePadding;
         textBlockWidth = Math.min(textBlockWidth, maxWidth)


        // Рисуем фон с скруглением границ
        ctx.fillStyle = codeBackgroundColor;
        ctx.beginPath();
        ctx.moveTo(x + codeBorderRadius, y);
        ctx.lineTo(x + textBlockWidth - codeBorderRadius, y);
        ctx.quadraticCurveTo(x + textBlockWidth, y, x + textBlockWidth, y + codeBorderRadius);
        ctx.lineTo(x + textBlockWidth, y + blockHeight - codeBorderRadius);
        ctx.quadraticCurveTo(x + textBlockWidth, y + blockHeight, x + textBlockWidth - codeBorderRadius, y + blockHeight);
        ctx.lineTo(x + codeBorderRadius, y + blockHeight);
        ctx.quadraticCurveTo(x, y + blockHeight, x, y + blockHeight - codeBorderRadius);
        ctx.lineTo(x, y + codeBorderRadius);
        ctx.quadraticCurveTo(x, y, x + codeBorderRadius, y);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = codeBorderColor;
        ctx.lineWidth = 1
        ctx.stroke();

        // Рисуем текст кода
         currentY = y + codePadding + lineHeight;
          let lineRenderedCount = 0;

          for (const line of lines) {
            let currentX = x + codePadding;
             try {
                   const parts = Prism.tokenize(line, Prism.languages[language]);

                    for (const part of parts) {
                        if (typeof part === 'string') {
                             // Если это строка (пробел), отрисовываем ее
                            ctx.fillStyle = codeTextColor; // задаем цвет пробела
                             currentX += ctx.measureText(part).width
                             ctx.fillText(part, currentX - ctx.measureText(part).width, currentY);
                             if (currentX > x + maxWidth) {
                                currentX = x + codePadding;
                                currentY += lineHeight;
                              }
                         }  else {

                                const textPart = extractTextFromToken(part);
                                let tokenColor = codeTextColor;

                                if(part.type === 'comment'){
                                      tokenColor = codeHighlightColors.comment || codeTextColor;
                                } else if (part.type === 'string' || part.type === 'number'){
                                      tokenColor = codeHighlightColors.string || codeHighlightColors.number || codeTextColor;
                                } else if(part.type === 'keyword'){
                                    tokenColor = codeHighlightColors.keyword || codeTextColor;
                                } else if(part.type === 'function'){
                                     tokenColor = codeHighlightColors.function || codeTextColor;
                                } else if (part.type === 'parameter') {
                                     tokenColor = codeHighlightColors.parameter || codeTextColor;
                               } else if (part.type === 'variable') {
                                   tokenColor = codeHighlightColors.variable || codeTextColor;
                                } else if (part.type === 'operator' || part.type === 'punctuation'){
                                      tokenColor = codeHighlightColors.operator || codeHighlightColors.punctuation || codeTextColor;
                                 }
                                  for(let i=0; i < textPart.length; i++){
                                     const char = textPart[i];
                                       ctx.fillStyle = tokenColor;
                                      ctx.fillText(char, currentX, currentY);
                                       currentX += ctx.measureText(char).width;
                                        if (currentX > x + maxWidth) {
                                          currentX = x + codePadding;
                                           currentY += lineHeight;
                                        }
                                   }
                            }
                    }
                   if (lineRenderedCount < Math.floor(maxCodeHeight / lineHeight)) {
                       currentY += lineHeight;
                     lineRenderedCount++;
                     } else {
                      break;
                     }
               } catch (e) {
                  console.error("Ошибка отрисовки текста", e)
              }
        }
       return blockHeight;
    } catch (error) {
        console.error("Ошибка при рисовании блока кода:", { code, x, y, maxWidth, fontSettings, language, maxCodeHeight }, error);
        return 0;
    }
}

// Функция для рисования изображения
async function drawImageBlock(ctx, imagePath, x, y, maxWidth, maxHeight, codePadding, codeBorderRadius) {
    try {
        const absoluteImagePath = path.resolve(__dirname, imagePath);
        if (await fileExists(absoluteImagePath)) {
            const image = await loadImage(absoluteImagePath);
            let imgWidth = image.width;
            let imgHeight = image.height;
            let aspectRatio = imgWidth / imgHeight;
            if (imgWidth > maxWidth) {
                imgWidth = maxWidth;
                imgHeight = imgWidth / aspectRatio;
            }
            if (imgHeight > maxHeight) {
                imgHeight = maxHeight;
                imgWidth = imgHeight * aspectRatio;
            }
             const imgX = x + codePadding + (maxWidth - imgWidth) / 2;
            const imgY = y + codePadding + (maxHeight - imgHeight) / 2;
              ctx.beginPath();
            ctx.moveTo(x + codeBorderRadius, y);
            ctx.lineTo(x + maxWidth - codeBorderRadius, y);
            ctx.quadraticCurveTo(x + maxWidth, y, x + maxWidth, y + codeBorderRadius);
            ctx.lineTo(x + maxWidth, y + maxHeight - codeBorderRadius);
            ctx.quadraticCurveTo(x + maxWidth, y + maxHeight, x + maxWidth - codeBorderRadius, y + maxHeight);
            ctx.lineTo(x + codeBorderRadius, y + maxHeight);
            ctx.quadraticCurveTo(x, y + maxHeight, x, y + maxHeight - codeBorderRadius);
            ctx.lineTo(x, y + codeBorderRadius);
            ctx.quadraticCurveTo(x, y, x + codeBorderRadius, y);
            ctx.closePath();
            ctx.clip();

            ctx.drawImage(image, imgX, imgY, imgWidth, imgHeight);
            ctx.restore()
            return maxHeight + 2 * codePadding;
        } else {
            console.error("Изображение не найдено:", absoluteImagePath);
            return 0;
        }
    } catch (error) {
        console.error("Ошибка при загрузке или отрисовке изображения:", imagePath, error);
        return 0;
    }
}

async function loadImageOrUseDefault(backgroundImagePath, imageWidth, imageHeight) {
    try {
        const canvas = createCanvas(imageWidth, imageHeight);
        const ctx = canvas.getContext('2d');
        let backgroundImage = null;
        if (backgroundImagePath) {
            try {
                const absoluteImagePath = path.resolve(__dirname, backgroundImagePath);
                if (await fileExists(absoluteImagePath)) {
                    backgroundImage = await loadImage(absoluteImagePath);
                    ctx.drawImage(backgroundImage, 0, 0, imageWidth, imageHeight);
                    console.log(`Фоновое изображение загружено из: ${absoluteImagePath}`);
                } else {
                    console.error("Фоновое изображение не найдено:", absoluteImagePath);
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, imageWidth, imageHeight);
                }
            } catch (e) {
                console.error("Ошибка загрузки фонового изображения:", e);
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, imageWidth, imageHeight);
            }


        } else {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, imageWidth, imageHeight);
        }
        return { canvas, ctx };
    } catch (error) {
        console.error("Ошибка при создании канвы или загрузке фонового изображения:", error);
        const canvas = createCanvas(imageWidth, imageHeight);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, imageWidth, imageHeight);
        return { canvas, ctx }

    }
}

function drawTitleText(ctx, taskTitle, fontSettings, padding, imageWidth, marginTop) {
    try {
        if (!taskTitle) return { textY: marginTop, lines: [], lineHeight: 0 };
        const { titleSize, fontFamily, titleColor, titleHorizontalPosition } = fontSettings;
        const fontText = `${titleSize}px ${fontFamily}`;
        const maxWidth = imageWidth - 2 * padding;
        ctx.font = fontText;
        const lines = wrapText(taskTitle, ctx, maxWidth);
        let textY = marginTop;
        ctx.font = fontText;
        ctx.fillStyle = titleColor;
        const lineHeight = titleSize + 5;
        for (const line of lines) {
            let textX;
            if (titleHorizontalPosition === 'center') {
                textX = padding + (maxWidth - ctx.measureText(line).width) / 2
            } else if (titleHorizontalPosition === 'right') {
                textX = imageWidth - padding - ctx.measureText(line).width;
            } else {
                textX = padding;
            }
            ctx.fillText(line, textX, textY);
            textY += lineHeight;
        }
        return { textY, lines, lineHeight };
    } catch (error) {
        console.error("Ошибка при рисовании текста задачи:", taskTitle, error);
        return { textY: marginTop, lines: [], lineHeight: 0 };
    }
}

function drawBottomTitle(ctx, bottomTitle, fontSettings, padding, imageWidth, marginBottom, imageHeight) {
    try {
        if (!bottomTitle) return { textY: imageHeight, lines: [], lineHeight: 0 };
        const { bottomTitleSize, fontFamily, bottomTitleColor, bottomTitleHorizontalPosition } = fontSettings;
        const fontText = `${bottomTitleSize}px ${fontFamily}`;
        const maxWidth = imageWidth - 2 * padding;
        ctx.font = fontText;
        const lines = wrapText(bottomTitle, ctx, maxWidth);
        let lineHeight = bottomTitleSize + 5;
        let textY = imageHeight - marginBottom - (lines.length * lineHeight);
        ctx.font = fontText;
        ctx.fillStyle = bottomTitleColor;

        for (const line of lines) {
            let textX;
            if (bottomTitleHorizontalPosition === 'center') {
                textX = padding + (maxWidth - ctx.measureText(line).width) / 2
            } else if (bottomTitleHorizontalPosition === 'right') {
                textX = imageWidth - padding - ctx.measureText(line).width;
            } else {
                textX = padding
            }
            ctx.fillText(line, textX, textY);
            textY += lineHeight;
        }
        return { textY, lines, lineHeight };
    } catch (error) {
        console.error("Ошибка при рисовании нижнего заголовка:", bottomTitle, error);
        return { textY: imageHeight, lines: [], lineHeight: 0 };
    }
}

async function calculateCodeBlockPosition(ctx, code, imagePath, fontSettings, language, maxCodeHeight, codeBlockPosition, padding, imageWidth, imageHeight, lines, lineHeight, textY, codeBlockHorizontalPosition, bottomTitle, bottomTitleMargin) {
    try {
        let codeBlockHeight = 0;
        let codeY;
        let codeX;
         let tempCodeBlockWidth = 0;
          const {titleSize, codePadding} = fontSettings;
          const textHeight = (lines.length * lineHeight)
          let bottomTextHeight = 0;
          if(bottomTitle){
              const tempCanvas = createCanvas(imageWidth, imageHeight);
              const tempCtx = tempCanvas.getContext('2d');
              const {lines, lineHeight } = drawBottomTitle(tempCtx, bottomTitle, fontSettings, padding, imageWidth, bottomTitleMargin, imageHeight)
              bottomTextHeight = lines.length * lineHeight;
          }
          if (code) {
               const tempCanvas = createCanvas(imageWidth, imageHeight);
              const tempCtx = tempCanvas.getContext('2d');
               drawCodeBlock(tempCtx, code, padding, 0, imageWidth - 2 * padding, fontSettings, language, maxCodeHeight);
               tempCodeBlockWidth = tempCtx.measureText(code).width + 2 * fontSettings.codePadding;
                if (codeBlockPosition === 'start') {
                    codeY = padding;
                    // Вычисляем X координату
                 if (codeBlockHorizontalPosition === 'center') {
                       codeX = padding + ((imageWidth - 2 * padding) - tempCodeBlockWidth) / 2
                 } else if (codeBlockHorizontalPosition === 'right') {
                    codeX = imageWidth - padding - tempCodeBlockWidth;
                  } else {
                    codeX = padding;
                  }
                    codeBlockHeight = drawCodeBlock(ctx, code, codeX, codeY, tempCodeBlockWidth, fontSettings, language, maxCodeHeight);
                    textY = codeY + codeBlockHeight + 20;
                    const textX = padding;
                    for (const line of lines) {
                        ctx.fillText(line, textX, textY);
                        textY += lineHeight;
                    }
                } else if (codeBlockPosition === 'center') {
                    const tempCanvas = createCanvas(imageWidth, imageHeight);
                    const tempCtx = tempCanvas.getContext('2d');
                     const tempCodeBlockHeight = drawCodeBlock(tempCtx, code, padding, 0, imageWidth - 2 * padding, fontSettings, language, maxCodeHeight);
                      const availableHeight = imageHeight - 2 * padding
                      codeY = padding + (availableHeight - tempCodeBlockHeight - textHeight - bottomTextHeight) / 2 + textHeight;
                      if (codeY < textY + 20) {
                         codeY = textY + 20;
                       }
                     // Вычисляем X координату
                    if (codeBlockHorizontalPosition === 'center') {
                          codeX = padding + ((imageWidth - 2 * padding) - tempCodeBlockWidth) / 2;
                     } else if (codeBlockHorizontalPosition === 'right') {
                        codeX = imageWidth - padding - tempCodeBlockWidth;
                     } else {
                        codeX = padding;
                    }
                   codeBlockHeight = drawCodeBlock(ctx, code, codeX, codeY, tempCodeBlockWidth, fontSettings, language, maxCodeHeight);
              } else if (codeBlockPosition === 'end') {
                    codeY = imageHeight - maxCodeHeight - padding - 20 - bottomTextHeight;
                    if (codeY < textY) {
                         codeY = textY + 20;
                    }
                      // Вычисляем X координату
                    if (codeBlockHorizontalPosition === 'center') {
                          codeX = padding + ((imageWidth - 2 * padding) - tempCodeBlockWidth) / 2;
                    } else if (codeBlockHorizontalPosition === 'right') {
                          codeX = imageWidth - padding - tempCodeBlockWidth;
                   } else {
                        codeX = padding;
                  }
                    codeBlockHeight = drawCodeBlock(ctx, code, codeX, codeY, tempCodeBlockWidth, fontSettings, language, maxCodeHeight);
                }
        } else if (imagePath) {

             const tempCanvas = createCanvas(imageWidth, imageHeight);
            const tempCtx = tempCanvas.getContext('2d');
             const maxHeightForImage = maxCodeHeight + 2 * codePadding;
            const tempImageHeight = await drawImageBlock(tempCtx, imagePath, padding, 0, imageWidth - 2 * padding, maxHeightForImage, codePadding, fontSettings.codeBorderRadius)
             // Вычисляем X координату
            if (codeBlockPosition === 'start') {
                  codeY = padding;
                   if (codeBlockHorizontalPosition === 'center') {
                       codeX = padding + ((imageWidth - 2 * padding) - (imageWidth - 2 * padding)) / 2
                  } else if (codeBlockHorizontalPosition === 'right') {
                        codeX = imageWidth - padding - (imageWidth - 2 * padding);
                  } else {
                       codeX = padding;
                  }
                  codeBlockHeight = await drawImageBlock(ctx, imagePath, codeX, codeY, imageWidth - 2 * padding, maxHeightForImage, codePadding, fontSettings.codeBorderRadius);
                    textY = codeY + codeBlockHeight + 20;
                   const textX = padding;
                    for (const line of lines) {
                         ctx.fillText(line, textX, textY);
                        textY += lineHeight;
                   }
             } else if (codeBlockPosition === 'center') {
                   const availableHeight = imageHeight - 2 * padding
                    codeY = padding + (availableHeight - tempImageHeight - textHeight - bottomTextHeight) / 2 + textHeight;
                    if (codeY < textY + 20) {
                      codeY = textY + 20;
                    }
                     // Вычисляем X координату
                  if (codeBlockHorizontalPosition === 'center') {
                        codeX = padding + ((imageWidth - 2 * padding) - (imageWidth - 2 * padding)) / 2;
                   } else if (codeBlockHorizontalPosition === 'right') {
                        codeX = imageWidth - padding - (imageWidth - 2 * padding);
                   } else {
                       codeX = padding;
                  }
                  codeBlockHeight = await drawImageBlock(ctx, imagePath, codeX, codeY, imageWidth - 2 * padding, maxHeightForImage, codePadding, fontSettings.codeBorderRadius);
                } else if (codeBlockPosition === 'end') {
                    codeY = imageHeight - maxHeightForImage - padding - 20 - bottomTextHeight;
                     if (codeY < textY) {
                       codeY = textY + 20;
                     }
                     // Вычисляем X координату
                 if (codeBlockHorizontalPosition === 'center') {
                       codeX = padding + ((imageWidth - 2 * padding) - (imageWidth - 2 * padding)) / 2;
                 } else if (codeBlockHorizontalPosition === 'right') {
                       codeX = imageWidth - padding - (imageWidth - 2 * padding);
                 } else {
                       codeX = padding;
                 }
                 codeBlockHeight = await drawImageBlock(ctx, imagePath, codeX, codeY, imageWidth - 2 * padding, maxHeightForImage, codePadding, fontSettings.codeBorderRadius);
             }
          }
        return codeBlockHeight;
    } catch (error) {
        console.error("Ошибка при расчете позиции блока кода или изображения:", { code, imagePath, fontSettings, language, maxCodeHeight, codeBlockPosition, padding, imageWidth, imageHeight, lines, lineHeight, textY, codeBlockHorizontalPosition, bottomTitle, bottomTitleMargin }, error);
        return 0;
    }
}

async function drawGroupElement(ctx, groupElement, imageWidth, imageHeight) {
    try {
        if (!groupElement) return;
        const { type, content, fontSize, fontColor, fontFamily, imagePath, marginRight, marginBottom } = groupElement;
        if (type === "text" && content) {
            ctx.font = `${fontSize}px ${fontFamily}`;
            ctx.fillStyle = fontColor;
            const textWidth = ctx.measureText(content).width
            const textX = imageWidth - marginRight - textWidth
            const textY = imageHeight - marginBottom
            ctx.fillText(content, textX, textY);
        } else if (type === 'image' && imagePath) {
            try {
                 const absoluteImagePath = path.resolve(__dirname, imagePath);
                if (await fileExists(absoluteImagePath)) {
                    const image = await loadImage(absoluteImagePath)
                    let imgWidth = image.width;
                    let imgHeight = image.height;
                    const imgX = imageWidth - marginRight - imgWidth
                    const imgY = imageHeight - marginBottom - imgHeight;
                    ctx.drawImage(image, imgX, imgY, imgWidth, imgHeight);
                } else {
                     console.error("Изображение группы не найдено:", absoluteImagePath);
                }
            } catch (e) {
                 console.error("Ошибка отрисовки изображения группы", e)
            }
        }
    } catch (error) {
        console.error("Ошибка при отрисовке элемента группы:", groupElement, error);
    }
}


async function saveImage(canvas, taskNumber, outputDir) {
    try {
        const imageName = `task_${taskNumber}.png`;
        const outputPath = path.join(outputDir, imageName);
        const buffer = canvas.toBuffer('image/png');
        if (!await fs.access(outputDir).catch(() => false)) {
            await fs.mkdir(outputDir, { recursive: true });
            console.log(`Создана директория: ${outputDir}`);
        }
        await fs.writeFile(outputPath, buffer);
        console.log(`Изображение сохранено в: ${outputPath}`);
    } catch (error) {
        console.error("Ошибка при сохранении изображения:", taskNumber, error);
    }
}

// Функция для создания изображения с задачей
async function createProgrammingTaskImage(taskTitle, taskNumber, code, language, imagePath, backgroundImagePath, outputDir, fontSettings, codeBlockPosition, codeBlockHorizontalPosition, bottomTitle, bottomTitleMargin, groupElement) {
    try {
        if (!taskTitle || !taskNumber) {
            console.error("Необходимо указать текст задачи и номер задачи.");
            return;
        }
        if (typeof fontSettings !== 'object' || fontSettings === null) {
            console.error("Некорректные настройки шрифта.");
            return;
        }
        if (groupElement && typeof groupElement !== 'object') {
            console.error("Некорректные настройки группового элемента.");
            return;
        }

        const imageWidth = 600;
        const imageHeight = 400;
        const padding = 10;
        const maxCodeHeight = 300;

        // Загрузка фонового изображения или использование белого фона
        const { canvas, ctx } = await loadImageOrUseDefault(backgroundImagePath, imageWidth, imageHeight);
        ctx.save()

        // Отрисовка текста задачи (без заголовка)
        const { textY, lines, lineHeight } = drawTitleText(ctx, taskTitle, fontSettings, padding, imageWidth, fontSettings.titleTopMargin);
        // Рисуем нижний заголовок
        const { textY: bottomTextY } = drawBottomTitle(ctx, bottomTitle, fontSettings, padding, imageWidth, bottomTitleMargin, imageHeight);
        // Расчет позиции и отрисовка блока кода или изображения
        await calculateCodeBlockPosition(ctx, code, imagePath, fontSettings, language, maxCodeHeight, codeBlockPosition, padding, imageWidth, imageHeight, lines, lineHeight, textY, codeBlockHorizontalPosition, bottomTitle, bottomTitleMargin);
        // Рисуем элемент группы
         await drawGroupElement(ctx, groupElement, imageWidth, imageHeight);
         ctx.restore()
        // Сохранение изображения
        await saveImage(canvas, taskNumber, outputDir);
    } catch (error) {
        console.error("Ошибка при создании изображения задачи:", { taskTitle, taskNumber, code, language, imagePath, backgroundImagePath, outputDir, fontSettings, codeBlockPosition, codeBlockHorizontalPosition, bottomTitle, bottomTitleMargin, groupElement }, error);
    }
}

// Основной код для генерации изображений
async function main() {
    try {
        await loadConfig();
        const { outputDir, backgroundImage, fontSettings, tasks, codeBlockPosition, codeBlockHorizontalPosition, groupElement } = config;
        console.log("Начало генерации изображений...");
        await Promise.all(tasks.map(async (task) => {
            await createProgrammingTaskImage(
                task.title,
                task.number,
                task.code,
                task.language,
                task.image,
                backgroundImage,
                outputDir,
                fontSettings,
                codeBlockPosition,
                codeBlockHorizontalPosition,
                task.bottomTitle,
                 fontSettings.bottomTitleMargin,
                groupElement
            );
        }));
        console.log("Генерация изображений завершена.");
    } catch (error) {
        console.error("Ошибка в главном цикле:", error);
    }
}

// Запускаем main
main();
