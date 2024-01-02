class GridState {
  constructor(mod) {
    this.mod = mod;

    this.gridSize = this.mod.gridSize;
    this.state = new Array(this.gridSize);
    for (let i = 0; i < this.gridSize; i++) {
      this.state[i] = new Array(this.gridSize);
      for (let j = 0; j < this.gridSize; j++) {
        this.state[i][j] = {confirmed: null, pending: null, drafted: null};
      }
    }
  }

  prettyPrint() {
    const nbColorCharacters = 7;
    const nbOrdinalDigits = 6;

    const statusHeaderLength = 2;
    const cellWidth = 1 + statusHeaderLength + 1 + nbColorCharacters + 1 + nbOrdinalDigits + 1;
    const cellHorizontalBorder = "-".repeat(cellWidth);
    const gridHorizontalBorder = new Array(this.gridSize + 1).fill("+").join(cellHorizontalBorder);

    const centeredNullText = (width) => {
      const nullText = "null";
      const nullTextLeftRightPaddingLength = width - (statusHeaderLength + 1) - nullText.length;
      const nullTextLeftPaddingLength  = Math.floor(nullTextLeftRightPaddingLength / 2);
      const nullTextRightPaddingLength = nullTextLeftRightPaddingLength - nullTextLeftPaddingLength;
      const nullTextLeftPaddingSpaces  = " ".repeat(nullTextLeftPaddingLength);
      const nullTextRightPaddingSpaces = " ".repeat(nullTextRightPaddingLength);
      return nullTextLeftPaddingSpaces + nullText + nullTextRightPaddingSpaces;
    }

    const ordinalToPrintedString = (ordinal) => {
      if (ordinal !== null) {
        return ordinal.toString().slice(- (nbOrdinalDigits + this.mod.txOrderPrecision), - this.mod.txOrderPrecision);
      } else {
        return centeredNullText(nbOrdinalDigits);
      }
    }

    for (let j = 0; j < this.gridSize; j++) {
      console.log(gridHorizontalBorder);
      for (const status of ["confirmed", "pending", "drafted"]) {
        const statusHeader = status[0] + ":";
        let line = "|";
        for (let i = 0; i < this.gridSize; i++) {
          line += " " + statusHeader;
          if (this.state[i][j][status] !== null) {
            line += " " + this.state[i][j][status].color
                  + " " + ordinalToPrintedString(this.state[i][j][status].ordinal)
                  + " ";
          } else {
            line += centeredNullText(cellWidth);
          }
          line += "|";
        }
        console.log(line);
      }
    }
    console.log(gridHorizontalBorder);
    console.log(" ");
    console.log(" ");
  }

  getTileColor(i, j) {
    if (this.state[i][j].confirmed !== null) {
      return this.state[i][j].confirmed.color;
    } else {
      return null;
    }
  }

  updateTile(tile, tileStatus, ordinal=null) {
    console.assert(tile !== null);
    const i = tile.i;
    const j = tile.j;
    switch (tileStatus) {
      case "confirmed":
        console.assert(ordinal !== null);
        console.assert(tile.color !== null);
        if (this.state[i][j].confirmed === null) {
          this.state[i][j].confirmed = {color: tile.color, ordinal: ordinal};
        } else {
          if (ordinal > this.state[i][j].confirmed.ordinal) {
            this.state[i][j].confirmed.color   = tile.color;
            this.state[i][j].confirmed.ordinal = ordinal;
          }
        }
        if (this.state[i][j].pending !== null) {
          if (ordinal >= this.state[i][j].pending.ordinal) {
            this.state[i][j].pending = null;
          }
        }
        break;
      case "pending":
        console.assert(ordinal !== null);
        console.assert(tile.color !== null);
        if (this.state[i][j].confirmed === null || ordinal > this.state[i][j].confirmed.ordinal) {
          if (this.state[i][j].pending === null) {
            this.state[i][j].pending = {color: tile.color, ordinal: ordinal};
          } else {
            if (ordinal > this.state[i][j].pending.ordinal) {
              this.state[i][j].pending.color   = tile.color;
              this.state[i][j].pending.ordinal = ordinal;
            }
          }
        }
        break;
      case "drafted":
        console.assert(ordinal === null);
        if (this.state[i][j].drafted === null && tile.color === null) {
          // nothing
        } else if (this.state[i][j].drafted === null && tile.color !== null) {
          this.state[i][j].drafted = {color: tile.color};
        } else if (this.state[i][j].drafted !== null && tile.color === null) {
          this.state[i][j].drafted = null;
        } else if (this.state[i][j].drafted !== null && tile.color !== null) {
          this.state[i][j].drafted.color = tile.color;
        }
        break;
      default:
        console.error("Unexpected tile status: " + tileStatus);
    }
    return {i: i, j: j, state: this.state[i][j]};
  }
}

module.exports = GridState;