import type { ReactNode } from 'react'
import { Box, Clip, Column, Image, Layer, Rect, Row, Text } from '#/graphics/ui'
import type { CornerRadius, GradientProps, GradientStop } from '#/graphics/ui'
import type { ExampleGraphicProps, ScorebugTeam } from './-types'

/**
 * Drexel basketball scorebug: raked metal panels, a carbon clock well,
 * lit seams between segments and a record/wordmark footer.
 */

const SC = 1
const GAP = 14
const SEAM_W = 7
const CORNER = 9

const ROW_H = 84 * SC
const CAP_W = 36 * SC
const PANEL_W = 268 * SC
const CLOCK_W = 158 * SC
const FOOT_H = 30 * SC
const BUG_W = CAP_W * 2 + PANEL_W * 2 + CLOCK_W + 4 * GAP
const FOOT_INSET = 14
const FOOT_W = BUG_W - FOOT_INSET * 2
/** Distance from the bottom of the frame to the bottom of the footer. */
const BOTTOM_INSET = 74

const PAD = 18 * SC
const LOGO_S = 64 * SC
/** Logos are deliberately oversized and cropped by their panel. */
const LOGO_BIG = ROW_H * 1.45

const CONDENSED = '/fonts/BarlowCondensed-Bold.ttf'
const CONDENSED_HEAVY = '/fonts/BarlowCondensed-ExtraBold.ttf'
const UI = '/fonts/Archivo-SemiBold.ttf'

const GOLD = '#FFC600'
const NAVY = '#07294D'
const FLAME = '#EF3B39'
const STEEL = '#9AA3AE'

/** troika measures letter spacing in em; these designs specify it in pixels. */
const tracking = (pixels: number, fontSize: number) => pixels / fontSize

/** Panels are brushed metal, i.e. a top-to-bottom ramp; `-90deg` puts stop 0 at the top. */
const vertical = (stops: GradientStop[]): GradientProps => ({ angle: -90, stops })

const BONE = vertical([
  { offset: 0, color: '#FFFFFF' },
  { offset: 0.52, color: '#F3F4F0' },
  { offset: 1, color: '#D8DAD2' },
])
const STEEL_NAVY = vertical([
  { offset: 0, color: '#0C3E71' },
  { offset: 0.46, color: '#07294D' },
  { offset: 1, color: '#03182E' },
])
const CARBON = vertical([
  { offset: 0, color: '#3A404A' },
  { offset: 0.58, color: '#15181D' },
  { offset: 1, color: '#0B0D11' },
])
const BRASS = vertical([
  { offset: 0, color: '#FFD84D' },
  { offset: 0.5, color: '#FFC600' },
  { offset: 1, color: '#DFA400' },
])

const AWAY: ScorebugTeam = {
  abbr: 'HOF',
  score: 61,
  record: '14-6  (4TH IN CAA)',
  logo: 'https://images.dragonstv.io/logos/HOFSTRA.PNG',
}

const HOME: ScorebugTeam = {
  abbr: 'DRE',
  score: 68,
  record: '16-4  (2ND IN CAA)',
  logo: 'https://images.dragonstv.io/logos-knockout/DREXEL.PNG',
}

/** Stand-in for a real blur: concentric black rects fading outwards. */
const SHADOW_LAYERS = [
  { spread: 2, opacity: 0.22 },
  { spread: 6, opacity: 0.14 },
  { spread: 12, opacity: 0.08 },
  { spread: 20, opacity: 0.04 },
]

function SoftShadow({ width, height }: { width: number; height: number }) {
  return (
    <>
      {SHADOW_LAYERS.map(({ spread, opacity }) => (
        <Rect
          key={spread}
          position="absolute"
          left={-spread}
          top={10 - spread}
          width={width + spread * 2}
          height={height + spread * 2}
          radius={14 + spread}
          fill="#000000"
          opacity={opacity}
        />
      ))}
    </>
  )
}

type PanelProps = {
  width: number
  gradient: GradientProps
  /** Which end of the bug this panel caps, if any. */
  round?: 'left' | 'right'
  children?: ReactNode
}

const ROUNDED: Record<'left' | 'right', CornerRadius> = {
  left: { topLeft: CORNER, bottomLeft: CORNER },
  right: { topRight: CORNER, bottomRight: CORNER },
}

/** One metal segment of the bug, cropping whatever overflows it. */
function Panel({ width, gradient, round, children }: PanelProps) {
  // Keep the edge highlights clear of a rounded corner, which they'd otherwise square off.
  const insetLeft = round === 'left' ? CORNER : 0
  const insetRight = round === 'right' ? CORNER : 0
  const edgeWidth = width - insetLeft - insetRight
  return (
    <Clip width={width} height={ROW_H}>
      <Box width={width} height={ROW_H} gradient={gradient} radius={round && ROUNDED[round]}>
        {children}
        <Rect position="absolute" left={insetLeft} top={0} width={edgeWidth} height={2} fill="#ffffff" opacity={0.22} />
        <Rect
          position="absolute"
          left={insetLeft}
          top={ROW_H - 2}
          width={edgeWidth}
          height={2}
          fill="#000000"
          opacity={0.3}
        />
      </Box>
    </Clip>
  )
}

/** Stand-in for an additive blur: pale gold rects fanning out from the seam. */
const GLOW_LAYERS = [
  { spread: 22, opacity: 0.035 },
  { spread: 15, opacity: 0.07 },
  { spread: 9, opacity: 0.12 },
  { spread: 4, opacity: 0.2 },
]
const GLOW = '#FFDE6A'

/** The divider sitting in the gap between two panels; lit ones bloom onto their neighbours. */
function Seam({ color, glow = false }: { color: string; glow?: boolean }) {
  return (
    <Box width={GAP} height={ROW_H} direction="row">
      {glow &&
        GLOW_LAYERS.map(({ spread, opacity }, i) => (
          <Rect
            key={spread}
            position="absolute"
            left={1 - spread}
            top={0}
            width={SEAM_W + spread * 2}
            height={ROW_H}
            fill={GLOW}
            opacity={opacity}
            zIndex={86 + i}
          />
        ))}
      <Rect width={SEAM_W} height={ROW_H} marginLeft={1} fill={color} zIndex={90} />
    </Box>
  )
}

/** Absolutely centers `children` on (`x`, `y`) within the parent's box. */
function Center({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  const width = 400
  const height = 120
  return (
    <Box
      position="absolute"
      left={x - width / 2}
      top={y - height / 2}
      width={width}
      height={height}
      direction="row"
      justify="center"
      align="center"
    >
      {children}
    </Box>
  )
}

function CapText({ label }: { label: string }) {
  return (
    <Column width="100%" height={ROW_H} justify="center" align="center">
      {[...label].map((char, i) => (
        <Text
          key={`${char}${i}`}
          font={CONDENSED_HEAVY}
          fontSize={26}
          lineHeight={1.05}
          letterSpacing={tracking(2, 26)}
          color={NAVY}
          singleLine
        >
          {char}
        </Text>
      ))}
    </Column>
  )
}

function Logo({ src, x }: { src: string; x: number }) {
  return (
    <Image
      src={src}
      fit="contain"
      position="absolute"
      left={x - LOGO_BIG / 2}
      top={(ROW_H - LOGO_BIG) / 2}
      width={LOGO_BIG}
      height={LOGO_BIG}
    />
  )
}

const SLASH_STEPS = [
  { width: 9, scale: 1, opacity: 1 },
  { width: 4, scale: 0.72, opacity: 0.55 },
  { width: 3, scale: 0.45, opacity: 0.28 },
]

function Slashes({ left, color }: { left: number; color: string }) {
  const height = 46 * SC
  return (
    <Box
      position="absolute"
      left={left}
      top={(ROW_H - height) / 2}
      height={height}
      direction="row"
      align="center"
      gap={6}
    >
      {SLASH_STEPS.map((step) => (
        <Rect key={step.width} width={step.width} height={height * step.scale} fill={color} opacity={step.opacity} />
      ))}
    </Box>
  )
}

const ARROW_W = 12
const ARROW_H = 16
const ARROW_SLICES = 16

/** Right-pointing possession arrow, sliced into rows since the primitives only draw rects. */
function Arrow({ left, top }: { left: number; top: number }) {
  return (
    <Box position="absolute" left={left} top={top} width={ARROW_W} height={ARROW_H}>
      {Array.from({ length: ARROW_SLICES }, (_, i) => {
        const distanceFromCenter = Math.abs((i + 0.5) / ARROW_SLICES - 0.5) * 2
        return (
          <Rect
            key={i}
            width={ARROW_W * (1 - distanceFromCenter)}
            height={ARROW_H / ARROW_SLICES}
            fill={GOLD}
          />
        )
      })}
    </Box>
  )
}

export function Scene({
  away = AWAY,
  home = HOME,
  clock = '10:36',
  period = '2ND',
  shotClock = 24,
  title = 'DREXEL BASKETBALL',
}: ExampleGraphicProps) {
  return (
    <Layer>
      <Column width="100%" height="100%" justify="end" align="center" paddingBottom={BOTTOM_INSET}>
        <Column width={BUG_W}>
          <SoftShadow width={BUG_W} height={ROW_H} />

          <Row width={BUG_W} height={ROW_H}>
            <Panel width={CAP_W} gradient={BONE} round="left">
              <CapText label={away.abbr} />
            </Panel>

            <Seam color={NAVY} glow={false} />

            <Panel width={PANEL_W} gradient={BONE}>
              <Logo src={away.logo} x={PAD + LOGO_S / 2} />
              <Rect
                position="absolute"
                left={PAD + LOGO_S + 14}
                top={ROW_H / 2 - 6}
                width={12}
                height={12}
                radius={6}
                fill={FLAME}
              />
              <Slashes left={PANEL_W - 150 * SC} color={NAVY} />
              <Center x={PANEL_W - 66 * SC} y={ROW_H / 2}>
                <Text font={CONDENSED_HEAVY} fontSize={64 * SC} color={NAVY} singleLine>
                  {away.score}
                </Text>
              </Center>
            </Panel>

            <Seam color={NAVY} />

            <Panel width={CLOCK_W} gradient={CARBON}>
              <Center x={CLOCK_W / 2} y={ROW_H * 0.36}>
                <Text
                  font={CONDENSED}
                  fontSize={40 * SC}
                  letterSpacing={tracking(1, 40 * SC)}
                  color="#ffffff"
                  singleLine
                >
                  {clock}
                </Text>
              </Center>
              <Center x={CLOCK_W / 2 - 38 * SC} y={ROW_H * 0.75}>
                <Text font={CONDENSED} fontSize={30 * SC} color={STEEL} singleLine>
                  {period}
                </Text>
              </Center>
              <Center x={CLOCK_W / 2 + 38 * SC} y={ROW_H * 0.75}>
                <Text font={CONDENSED_HEAVY} fontSize={30 * SC} color={GOLD} singleLine>
                  {shotClock}
                </Text>
              </Center>
            </Panel>

            <Seam color={GOLD} glow />

            <Panel width={PANEL_W} gradient={STEEL_NAVY}>
              <Center x={66 * SC} y={ROW_H / 2}>
                <Text font={CONDENSED_HEAVY} fontSize={64 * SC} color={GOLD} singleLine>
                  {home.score}
                </Text>
              </Center>
              <Slashes left={122 * SC} color={GOLD} />
              <Arrow left={158 * SC} top={(ROW_H - ARROW_H) / 2} />
              <Logo src={home.logo} x={PANEL_W - PAD - LOGO_S / 2} />
            </Panel>

            <Seam color={GOLD} glow />

            <Panel width={CAP_W} gradient={BRASS} round="right">
              <CapText label={home.abbr} />
            </Panel>
          </Row>

          <Box
            width={FOOT_W}
            height={FOOT_H}
            marginLeft={FOOT_INSET}
            background="#0A1018"
            opacity={0.82}
            radius={6}
          >
            <Row width={FOOT_W} height={FOOT_H} paddingX={20} align="center" justify="between">
              <Text font={UI} fontSize={14 * SC} letterSpacing={tracking(1.4, 14 * SC)} color={STEEL} singleLine>
                {away.record}
              </Text>
              <Text font={UI} fontSize={14 * SC} letterSpacing={tracking(1.4, 14 * SC)} color={STEEL} singleLine>
                {home.record}
              </Text>
            </Row>
            <Box
              position="absolute"
              left={0}
              top={0}
              width={FOOT_W}
              height={FOOT_H}
              direction="row"
              justify="center"
              align="center"
            >
              <Text
                font={CONDENSED}
                fontSize={19 * SC}
                letterSpacing={tracking(3.2, 19 * SC)}
                color={GOLD}
                singleLine
              >
                {title}
              </Text>
            </Box>
          </Box>
        </Column>
      </Column>
    </Layer>
  )
}
