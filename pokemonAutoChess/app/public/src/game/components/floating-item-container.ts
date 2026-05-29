import Phaser, { GameObjects } from "phaser"
import { Item } from "../../../../types/enum/Item"
import { Pkm, PkmIndex } from "../../../../types/enum/Pokemon"
import { preference } from "../../preferences"
import { GamePokemonDetailDOMWrapper } from "../../pages/component/game/game-pokemon-detail"
import { DEPTH } from "../depths"
import GameScene from "../scenes/game-scene"
import ItemDetail from "./item-detail"
import MinigameManager from "./minigame-manager"
import { loadCompressedAtlas } from "./pokemon"

export class FloatingItemContainer extends GameObjects.Container {
  scene: GameScene
  manager: MinigameManager
  name: Item
  circle: GameObjects.Ellipse
  sprite: GameObjects.Image
  id: string
  detail: ItemDetail | GamePokemonDetailDOMWrapper | undefined
  mouseoutTimeout: NodeJS.Timeout | null = null
  priceText: GameObjects.Text | null = null
  pokemonName: string = ""

  constructor(
    manager: MinigameManager,
    id: string,
    x: number,
    y: number,
    item: Item,
    price: number = 0,
    pokemonName: string = ""
  ) {
    super(manager.scene, x, y)
    this.scene = manager.scene
    this.manager = manager
    this.name = item
    this.id = id
    this.pokemonName = pokemonName
    this.circle = new GameObjects.Ellipse(
      manager.scene,
      0,
      0,
      40,
      40,
      0x61738a,
      1
    )
    this.circle.setStrokeStyle(1, 0xffffff, 0.7)
    this.add(this.circle)

    if (pokemonName && pokemonName !== "") {
      const index = PkmIndex[pokemonName as Pkm]
      this.sprite = new GameObjects.Image(
        manager.scene,
        0,
        0,
        `portrait-${index}`
      )
      this.sprite.setScale(0.5)
      loadCompressedAtlas(manager.scene, index).then(() => {
        if (!this.sprite?.scene) return
        const frameName = `Normal/Idle/Anim/0/0000`
        if (manager.scene.textures.exists(index)) {
          this.sprite.setTexture(index, frameName)
          this.sprite.setScale(1.5)
        }
      })
    } else {
      this.sprite = new GameObjects.Image(
        manager.scene,
        0,
        0,
        "item",
        this.name + ".png"
      )
      this.sprite.setScale(0.32)
    }
    this.add(this.sprite)
    this.setDepth(DEPTH.INANIMATE_OBJECTS)

    if (price > 0) {
      this.priceText = new GameObjects.Text(
        manager.scene,
        0,
        -26,
        `${price}g`,
        {
          fontSize: "12px",
          fontFamily: "monospace",
          color: "#ffd700",
          stroke: "#000000",
          strokeThickness: 3,
          align: "center"
        }
      )
      this.priceText.setOrigin(0.5, 0.5)
      this.add(this.priceText)
    }

    if (pokemonName && pokemonName !== "") {
      const nameText = new GameObjects.Text(
        manager.scene,
        0,
        20,
        pokemonName.replace(/_/g, " "),
        {
          fontSize: "8px",
          fontFamily: "monospace",
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: 2,
          align: "center"
        }
      )
      nameText.setOrigin(0.5, 0.5)
      this.add(nameText)
    }

    this.setSize(40, 40)
    this.setInteractive()
      .on("pointerover", (pointer: Phaser.Input.Pointer) => {
        this.onPointerOver(pointer)
      })
      .on("pointerout", () => this.onPointerOut())
      .on(
        "pointerdown",
        (
          pointer: Phaser.Input.Pointer,
          _x: number,
          _y: number,
          event: Phaser.Types.Input.EventData
        ) => {
          this.onPointerDown(pointer, event)
        }
      )

    this.scene.add.existing(this)
  }

  onGrab(playerId) {
    const currentPlayerId: string = (this.scene as GameScene).uid!
    if (playerId === currentPlayerId) {
      this.circle.setStrokeStyle(2, 0x4cff00, 1)
      this.circle.setFillStyle(0x61738a, 1)
    } else if (playerId == "") {
      this.circle.setStrokeStyle(1, 0xffffff, 0.7)
      this.circle.setFillStyle(0x61738a, 1)
    } else {
      this.circle.setStrokeStyle(2, 0xcf0000, 0.7)
      this.circle.setFillStyle(0x61738a, 0.7)
    }
  }

  openDetail() {
    this.scene.closeTooltips() // close other open item tooltips

    if (this.detail === undefined) {
      if (this.pokemonName && this.pokemonName !== "") {
        this.detail = new GamePokemonDetailDOMWrapper(
          this.scene, 0, 0,
          this.pokemonName as Pkm,
          "shop"
        )
      } else {
        this.detail = new ItemDetail(this.scene, 0, 0, this.name)
      }
      this.detail.setDepth(DEPTH.TOOLTIP)
      this.detail.setPosition(
        this.detail.width * 0.5 + 40,
        this.detail.height * 0.5
      )
      this.detail.setVisible(false)
      this.detail.dom.addEventListener("mouseenter", () => {
        this.mouseoutTimeout && clearTimeout(this.mouseoutTimeout)
      })
      this.detail.dom.addEventListener("mouseleave", () => {
        if (preference("showDetailsOnHover")) {
          this.mouseoutTimeout = setTimeout(() => {
            if (this.detail?.visible) {
              this.closeDetail()
            }
          }, 0)
        }
      })

      this.add(this.detail)
    }

    this.detail.setVisible(true)
  }

  closeDetail() {
    this.detail?.setVisible(false)
  }

  onPointerOver(pointer) {
    if (preference("showDetailsOnHover") && !this.detail?.visible) {
      this.mouseoutTimeout && clearTimeout(this.mouseoutTimeout)
      this.openDetail()
    }
  }

  onPointerOut() {
    if (preference("showDetailsOnHover")) {
      this.mouseoutTimeout = setTimeout(() => {
        if (this.detail?.visible) {
          this.closeDetail()
        }
      }, 0)
    }
  }

  onPointerDown(
    pointer: Phaser.Input.Pointer,
    event: Phaser.Types.Input.EventData
  ) {
    if (pointer.rightButtonDown() && !preference("showDetailsOnHover")) {
      if (!this.detail?.visible) {
        this.openDetail()
      } else {
        this.closeDetail()
      }
    }
  }
}
