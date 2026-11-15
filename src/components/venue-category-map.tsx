import { StyleSheet, View } from 'react-native';
import Svg, { Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { Text, useTheme } from 'react-native-paper';

import { type TicketCategory } from '@/lib/api';

const categoryColors = ['#38bdf8', '#a78bfa', '#f472b6', '#fb923c', '#4ade80', '#f87171'];
const defaultBandCount = 4;

type VenueArea = {
  id: string | number;
  name: string;
  price?: number | string;
};

type VenueCategoryMapProps = {
  venueName: string;
  venueCity?: string | null;
  venueAddress?: string | null;
  venueType?: string | null;
  categories: TicketCategory[];
  fallbackAreas?: VenueArea[];
};

const layoutLabels: Record<string, string> = {
  arena: 'Arena melingkar',
  stadium: 'Stadium',
  outdoor: 'Festival outdoor',
  hall: 'Concert hall',
};

export function VenueCategoryMap({
  venueName,
  venueCity,
  venueAddress,
  venueType,
  categories,
  fallbackAreas = [],
}: VenueCategoryMapProps) {
  const theme = useTheme();
  const layout = (venueType || 'hall').toLowerCase();
  const areas: VenueArea[] = categories.length
    ? categories.map((category) => ({
        id: category.id,
        name: category.category,
        price: category.price,
      }))
    : fallbackAreas;
  const bandCount = areas.length || defaultBandCount;
  const getColor = (index: number) => categoryColors[index % categoryColors.length];
  const categoryIndexAtDepth = (depthIndex: number, depthCount: number) => (
    areas.length && depthCount > 1
      ? Math.round((depthIndex / (depthCount - 1)) * (areas.length - 1))
      : depthIndex
  );
  const renderCategoryLabel = (index: number, x: number, y: number, fontSize = 12) => {
    const name = areas[index]?.name;
    if (!name) return null;
    return (
      <SvgText
        key={`${index}-${x}-${y}`}
        x={x}
        y={y}
        textAnchor="middle"
        alignmentBaseline="middle"
        fill="#111827"
        fontSize={name.length > 10 ? Math.min(fontSize, 9) : fontSize}
        fontWeight="700"
      >
        {name}
      </SvgText>
    );
  };
  const renderStage = (x: number, y: number, width: number, height = 38) => (
    <G>
      <Rect x={x} y={y} width={width} height={height} rx={5} fill="#f8fafc" />
      <SvgText
        x={x + width / 2}
        y={y + height * 0.63}
        textAnchor="middle"
        alignmentBaseline="middle"
        fill="#111827"
        fontSize={15}
        fontWeight="700"
      >
        STAGE
      </SvgText>
    </G>
  );
  const hallDepths = {
    bottomSide: categoryIndexAtDepth(0, 6),
    bottomCenter: categoryIndexAtDepth(1, 6),
    middleSide: categoryIndexAtDepth(2, 6),
    middleCenter: categoryIndexAtDepth(3, 6),
    topSide: categoryIndexAtDepth(4, 6),
    topCenter: categoryIndexAtDepth(5, 6),
  };
  const stadiumStepX = 155 / bandCount;
  const stadiumStepY = 95 / bandCount;

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.outlineVariant }]}>
        <View style={styles.headerText}>
          <Text variant="titleSmall" numberOfLines={1} style={styles.venueName}>{venueName}</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {layoutLabels[layout] || 'Denah venue'}
          </Text>
        </View>
        <Text variant="labelSmall" style={[styles.badge, { color: theme.colors.onSurfaceVariant, borderColor: theme.colors.outlineVariant }]}>
          DENAH AREA
        </Text>
      </View>

      <View style={styles.mapContainer}>
        <Svg viewBox="0 0 640 390" width="100%" height={240} preserveAspectRatio="xMidYMid meet">
          <Rect x="0" y="0" width="640" height="390" rx="16" fill="#0b1220" />

          {layout === 'arena' && (
            <G>
              {Array.from({ length: bandCount }, (_, bandIndex) => {
                const progress = bandCount > 1 ? bandIndex / (bandCount - 1) : 0;
                const radiusY = 145 - progress * 90;
                const bandHeight = bandCount > 1 ? 90 / (bandCount - 1) : 0;
                return (
                  <G key={`arena-${bandIndex}`}>
                    <Ellipse
                      cx={320}
                      cy={220}
                      rx={245 - progress * 155}
                      ry={radiusY}
                      fill={getColor(bandIndex)}
                    />
                    {renderCategoryLabel(
                      bandIndex,
                      320,
                      220 - radiusY + (bandCount > 1 ? bandHeight / 2 : 25),
                      10,
                    )}
                  </G>
                );
              })}
              <Ellipse cx={320} cy={220} rx={75} ry={38} fill="#111827" />
              {renderStage(260, 201, 120)}
            </G>
          )}

          {layout === 'hall' && (
            <G>
              {renderStage(230, 24, 180)}
              <Path d="M95 103 L215 103 L203 163 L80 163 Z" fill={getColor(hallDepths.topSide)} />
              <Path d="M425 103 L545 103 L560 163 L437 163 Z" fill={getColor(hallDepths.topSide)} />
              <Rect x="230" y="103" width="180" height="60" rx="5" fill={getColor(hallDepths.topCenter)} />
              <Path d="M75 181 L211 181 L201 235 L68 235 Z" fill={getColor(hallDepths.middleSide)} />
              <Path d="M429 181 L565 181 L572 235 L439 235 Z" fill={getColor(hallDepths.middleSide)} />
              <Rect x="222" y="178" width="196" height="60" rx="5" fill={getColor(hallDepths.middleCenter)} />
              <Path d="M116 256 L220 256 L213 310 L106 310 Z" fill={getColor(hallDepths.bottomSide)} />
              <Path d="M420 256 L524 256 L534 310 L427 310 Z" fill={getColor(hallDepths.bottomSide)} />
              <Rect x="232" y="253" width="176" height="58" rx="5" fill={getColor(hallDepths.bottomCenter)} />
              {renderCategoryLabel(hallDepths.topCenter, 320, 133)}
              {renderCategoryLabel(hallDepths.middleCenter, 320, 208)}
              {renderCategoryLabel(hallDepths.bottomCenter, 320, 282)}
              {renderCategoryLabel(hallDepths.topSide, 145, 139, 10)}
              {renderCategoryLabel(hallDepths.topSide, 495, 139, 10)}
              {renderCategoryLabel(hallDepths.middleSide, 140, 208, 10)}
              {renderCategoryLabel(hallDepths.middleSide, 500, 208, 10)}
              {renderCategoryLabel(hallDepths.bottomSide, 160, 283, 10)}
              {renderCategoryLabel(hallDepths.bottomSide, 480, 283, 10)}
            </G>
          )}

          {layout === 'outdoor' && (
            <G>
              {renderStage(250, 22, 140)}
              {Array.from({ length: bandCount }, (_, bandIndex) => {
                const bandHeight = 250 / bandCount;
                const y = 86 + (bandCount - bandIndex - 1) * bandHeight;
                const inset = (bandCount - bandIndex - 1) * (120 / bandCount);
                return (
                  <G key={`outdoor-${bandIndex}`}>
                    <Path
                      d={`M${126 + inset} ${y} L${514 - inset} ${y} L${514 - inset - 12} ${y + bandHeight} L${126 + inset + 12} ${y + bandHeight} Z`}
                      fill={getColor(bandIndex)}
                    />
                    {renderCategoryLabel(bandIndex, 320, y + bandHeight / 2, 10)}
                  </G>
                );
              })}
            </G>
          )}

          {layout === 'stadium' && (
            <G>
              {Array.from({ length: bandCount }, (_, bandIndex) => {
                const rx = 275 - bandIndex * stadiumStepX;
                const ry = 165 - bandIndex * stadiumStepY;
                const innerRy = bandIndex === bandCount - 1
                  ? 40
                  : 165 - (bandIndex + 1) * stadiumStepY;
                return (
                  <G key={`stadium-${bandIndex}`}>
                    <Ellipse cx={320} cy={195} rx={rx} ry={ry} fill={getColor(bandIndex)} />
                    {renderCategoryLabel(bandIndex, 320, 195 - (ry + innerRy) / 2, 10)}
                  </G>
                );
              })}
              <Ellipse cx={320} cy={195} rx={82} ry={40} fill="#0b1220" />
              {renderStage(260, 178, 120, 34)}
            </G>
          )}
        </Svg>
      </View>

      {areas.length > 0 && (
        <View style={[styles.legend, { borderTopColor: theme.colors.outlineVariant }]}>
          {areas.map((area, index) => (
            <View key={area.id} style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: getColor(index) }]} />
              <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>{area.name}</Text>
            </View>
          ))}
        </View>
      )}

      {[venueCity, venueAddress].filter(Boolean).length > 0 && (
        <Text variant="bodySmall" style={[styles.location, { color: theme.colors.onSurfaceVariant }]}>
          {[venueCity, venueAddress].filter(Boolean).join(' · ')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerText: { flex: 1, gap: 2 },
  venueName: { fontWeight: '700' },
  badge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, overflow: 'hidden', fontSize: 9, letterSpacing: 0.6 },
  mapContainer: { margin: 12, padding: 8, borderRadius: 14, backgroundColor: '#0b1220', overflow: 'hidden' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 10, height: 10, borderRadius: 2 },
  location: { paddingHorizontal: 14, paddingBottom: 14, lineHeight: 19 },
});
