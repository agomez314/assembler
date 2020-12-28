/** 
 * @file This program translates any assembly program into its binary equivalent.
 * To use, run node assembler.js <filename>
 * @author: Alejandro Gomez
*/

const fs = require('fs');
const filename = process.argv[2]

const commentsRegex = new RegExp(/\/\/.*/g)
const newLinesRegex = new RegExp(/\r\n/g)
const USER_VARIABLE_INDEX = 16

/** Main entrypoint of the program. It reads a textfile and creates a new 'hack' binary file */
fs.readFile(`./${filename}`, 'utf8', (err, data) => {
    if (err) throw err;
    fs.writeFile(`./${filename}.hack`, parse(data), err => {
        if (err) throw err
        console.log('finished writing.')
    })
})

/** 
 * parses the input data from the textfile and converts to its corresponding binary 
 * @param {string} data - datafile
 * @returns {string} output
 */
function parse(data) { 
    const noWhitespace = data.replace(commentsRegex, '').trim()
    const labelTable = populateLabelTable(noWhitespace)
    const userVariableTable = populateUserVariableTable(noWhitespace, labelTable)
    return translateInstructions(noWhitespace, labelTable, userVariableTable)
}

/**
 * Create an object of labels with their corresponding index. The index is calculated
 * as the line number of the code that follows it. Labels are not counted
 * towards the number of lines in the program.
 * @param {string} data  
 * @returns {object} table
 */
function populateLabelTable(data) {
    let table = {}
    let indexWithoutLabels = 0
    data.split(newLinesRegex).forEach((instruction, index) => {
        instruction = instruction.trim()
        if (instruction[0] != '(') {
            indexWithoutLabels += 1
        }
        if (instruction[0] === '(' && !table.hasOwnProperty(instruction)) {
            table[instruction] = indexWithoutLabels//calculate 'real' index here
        }
    })
    return table
}

/**
 * Main translation function. Depending on line item it will apply a different 
 * translation function
 * @param {string} str 
 * @param {object} labelTable 
 */
function translateInstructions(str, labelTable, userVariableTable) {
    let result = '';
    const insturctionsArr = str.split(newLinesRegex)
    
    for (let line = 0; line < insturctionsArr.length; line++) {
        let instruction = insturctionsArr[line].trim()

        const isARegister = instruction[0] === '@'
        const isCRegister = instruction[0] !== '('
        
        // is a register
        if (isARegister) {
            instruction = instruction.slice(1)
            const isANumber = !isNaN(instruction)
            const isAPreDefinedSymbol = symbolTable.hasOwnProperty(instruction)
            const key = '(' + instruction + ')'
            const isALabel = labelTable.hasOwnProperty(key)

            if (isANumber) {
                result = result + convertToBinary(instruction) + '\n'
            } else if (isAPreDefinedSymbol) {
                result = result + symbolTable[instruction] + '\n'
            } else if (isALabel)  {
                let decimal = labelTable[key]
                result = result + convertToBinary(decimal) + '\n'
            } else { //is a variable
                result = result + convertToBinary(userVariableTable[instruction]) + '\n'
            }   
        } 
        
        // is an instruction
        else if (isCRegister){
            result = result + convertInstruction(instruction) + '\n'
        }
    }
    return result.trim()
}

/**
 * Populates a table with user variables and their corresponding register index
 * @param {string} data 
 * @param {object} labelTable 
 */
function populateUserVariableTable(data, labelTable) {
    let userVariableTable = {}
    let index = USER_VARIABLE_INDEX
    data.split(newLinesRegex).forEach(instruction => {
        instruction = instruction.trim()
        if (
            instruction[0] === '@' && 
            isNaN(instruction.slice(1)) &&
            !labelTable.hasOwnProperty('(' + instruction.slice(1) + ')') &&
            !symbolTable.hasOwnProperty(instruction.slice(1)) &&
            !userVariableTable.hasOwnProperty(instruction.slice(1))
        ) {
            userVariableTable[instruction.slice(1)] = index++
        }
    })
    return userVariableTable
}

/**
 * Converts a number to binary and sends to padTo16 to pad.
 * @param {string} num 
 * @returns {string}
 */
function convertToBinary(num) {
    const binary = Number(num).toString(2)
    return padTo16(binary)
}
/**
 * Pads a binary number string to 16 bits
 * @param {string} num 
 * @returns {string}
 */
function padTo16(num) {
    if (num.length > 16) throw Error('number is too large')
    let result = '';
    while (result.length < 16-num.length) result += '0'
    result += num
    return result
}

/**
 * Translates the destination bits
 * @param {string} instruction 
 * @returns {string}
 */
function translateDest(instruction) {
    let result = ''
    if (instruction.includes('=')) {
        let instr = instruction.split('=')[0]
        result = destTable[instr]
    } else {
        result = '000'
    }
    return result
}

/**
 * Translates the comparison bits
 * @param {string} instruction
 * @returns {string}
 */
function translateComp(instruction) {
    let result = ''
    if (instruction.includes('=')) {
        let instr = instruction.split('=')[1]
        result = compTable[instr].a + compTable[instr].instruction
    } else {
        let instr = instruction.split(';')
        if (instr.length > 1) {
            instr = instr[0]
            result = compTable[instr].a + compTable[instr].instruction
        } else {
            result = compTable[instruction].a + compTable[instruction].instruction
        }
    }
    return result
}

/**
 * Translates the jump bits
 * @param {string} instruction
 * @returns {string}
 */
function translateJmp(instruction) {
    let result = ''
    if (instruction.includes(';')) {
        let instr = instruction.split(';')[1]
        result = jmpTable[instr]
    } else {
        result = '000'
    }
    return result
}

/**
 * Puts together the bits of a C-intruction
 * @param {string} instruction
 * @returns {string}
 */
function convertInstruction(instruction) {
    if (!instruction) return ''
    return '111' + 
        translateComp(instruction) + 
        translateDest(instruction) + 
        translateJmp(instruction)
}

const symbolTable = {
    'R0': '0000000000000000',
    'R1': '0000000000000001',
    'R2': '0000000000000010',
    'R3': '0000000000000011',
    'R4': '0000000000000100',
    'R5': '0000000000000101',
    'R6': '0000000000000110',
    'R7': '0000000000000111',
    'R8': '0000000000001000',
    'R9': '0000000000001001',
    'R10': '0000000000001010',
    'R11': '0000000000001011',
    'R12': '0000000000001100',
    'R13': '0000000000001101',
    'R14': '0000000000001110',
    'R15': '0000000000001111',
    'KBD':'0110000000000000',
    'SCREEN':'0100000000000000',
    'SP':'0000000000000000',
    'LCL':'0000000000000001',
    'ARG':'0000000000000010',
    'THIS':'0000000000000011',
    'THAT':'0000000000000100'
}
const compTable = {
    '0': {
        a: 0,
        instruction: '101010'
    },
    '1': {
        a:0,
        instruction: '111111'
    },
    '-1': {
        a:0,
        instruction: '111010'
    },
    'D': {
        a:0,
        instruction: '001100'
    },
    'A': {
        a:0,
        instruction: '110000'
    },
    'M': {
        a:1,
        instruction: '110000'
    },
    '!D': {
        a:0,
        instruction: '001101'
    },
    '!A': {
        a:0,
        instruction: '110011'
    },
    '!M': {
        a:1,
        instruction: '110001'
    },
    '-D':{
        a:0,
        instruction:'001111'
    },
    '-A':{
        a:0,
        instruction:'110011'
    },
    '-M':{
        a:1,
        instruction:'110011'
    },
    'D+1':{
        a:0,
        instruction:'011111'
    },
    'A+1':{
        a:0,
        instruction:'110111'
    },
    'M+1':{
        a:1,
        instruction:'110111'
    },
    'D-1':{
        a:0,
        instruction:'001110'
    },
    'A-1':{
        a:0,
        instruction:'110010'
    },
    'M-1':{
        a:1,
        instruction:'110010'
    },
    'D+A':{
        a:0,
        instruction:'000010'
    },
    'D+M':{
        a:1,
        instruction:'000010'
    },
    'D-A':{
        a:0,
        instruction:'010011'
    },
    'D-M':{
        a:1,
        instruction:'010011'
    },
    'A-D':{
        a:0,
        instruction:'000111'
    },
    'M-D':{
        a:1,
        instruction:'000111'
    },
    'D&A':{
        a:0,
        instruction:'000000'
    },
    'D&M':{
        a:1,
        instruction:'000000'
    },
    'D|A':{
        a:0,
        instruction:'010101'
    },
    'D|M':{
        a:1,
        instruction:'010101'
    }
}
const destTable = {
    'null': '000',
    'M':'001',
    'D':'010',
    'MD':'011',
    'A':'100',
    'AM':'101',
    'AD':'110',
    'AMD':'111'
}
const jmpTable = {
    'null':'000',
    'JGT':'001',
    'JEQ':'010',
    'JGE':'011',
    'JLT':'100',
    'JNE':'101',
    'JLE':'110',
    'JMP':'111'
}
