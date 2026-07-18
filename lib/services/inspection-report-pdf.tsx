import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  Document,
  Font,
  Image,
  Line,
  Page,
  Polyline,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer';

import type { InspectionReport } from '@/types/inspection-report';

const DIN_A4_SIZE = { height: 841.89, width: 595.28 } as const;

Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    color: '#17211b',
    fontFamily: 'Helvetica',
    fontSize: 9,
    paddingBottom: 32,
    paddingHorizontal: 30,
    paddingTop: 26,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  brand: { alignItems: 'center', flexDirection: 'row' },
  logo: {
    borderRadius: 20,
    height: 40,
    marginRight: 10,
    width: 40,
  },
  title: { fontSize: 17, fontWeight: 700 },
  subtitle: { color: '#68766e', fontSize: 7.5, marginTop: 3 },
  badge: {
    backgroundColor: '#edf4ef',
    borderRadius: 10,
    color: '#315b3e',
    fontSize: 6.5,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  metadata: {
    borderBottomColor: '#d7dfda',
    borderBottomWidth: 1,
    borderTopColor: '#d7dfda',
    borderTopWidth: 1,
    flexDirection: 'row',
    marginBottom: 14,
    paddingVertical: 9,
  },
  metadataItem: {
    borderRightColor: '#d7dfda',
    borderRightWidth: 1,
    flexGrow: 1,
    paddingHorizontal: 9,
    width: '25%',
  },
  metadataItemLast: { borderRightWidth: 0 },
  label: {
    color: '#68766e',
    fontSize: 6,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  value: { fontSize: 8.5, fontWeight: 700, lineHeight: 1.2 },
  finding: {
    backgroundColor: '#315b3e',
    borderRadius: 6,
    color: '#ffffff',
    marginBottom: 14,
    padding: 13,
  },
  findingLabel: {
    color: '#cfe0d3',
    fontSize: 6.5,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  findingTitle: { fontSize: 13, fontWeight: 700, marginBottom: 5 },
  findingSummary: { color: '#f5f7f5', fontSize: 9, lineHeight: 1.35 },
  columns: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  mainColumn: { width: '57%' },
  sideColumn: { width: '43%' },
  panel: {
    borderColor: '#d7dfda',
    borderRadius: 5,
    borderWidth: 1,
    marginBottom: 10,
    padding: 10,
  },
  sectionTitle: {
    color: '#315b3e',
    fontSize: 7.5,
    fontWeight: 700,
    marginBottom: 7,
    textTransform: 'uppercase',
  },
  body: { lineHeight: 1.35 },
  evidence: {
    borderBottomColor: '#e7ece8',
    borderBottomWidth: 1,
    marginBottom: 7,
    paddingBottom: 7,
  },
  evidenceHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  evidenceSource: {
    color: '#315b3e',
    fontSize: 6.5,
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  evidenceMeta: { color: '#77837b', fontSize: 6 },
  chartHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metric: { color: '#315b3e', fontSize: 18, fontWeight: 700 },
  chartFrame: { height: 130 },
  chartDates: {
    color: '#68766e',
    flexDirection: 'row',
    fontSize: 6.5,
    justifyContent: 'space-between',
  },
  photo: {
    borderRadius: 3,
    height: 94,
    objectFit: 'cover',
    width: '100%',
  },
  planStep: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  stepNumber: {
    backgroundColor: '#315b3e',
    borderRadius: 8,
    color: '#ffffff',
    fontSize: 7,
    height: 16,
    marginRight: 7,
    paddingTop: 4,
    textAlign: 'center',
    width: 16,
  },
  stepContent: { flexGrow: 1, width: '88%' },
  stepLabel: {
    color: '#68766e',
    fontSize: 6,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  assessment: {
    backgroundColor: '#f5f7f5',
    borderRadius: 5,
    flexDirection: 'row',
    padding: 11,
  },
  assessmentColumn: { width: '50%' },
  assessmentDivider: {
    borderLeftColor: '#d7dfda',
    borderLeftWidth: 1,
    marginLeft: 10,
    paddingLeft: 10,
  },
  footer: {
    borderTopColor: '#d7dfda',
    borderTopWidth: 1,
    bottom: 20,
    color: '#68766e',
    fontSize: 6,
    left: 30,
    paddingTop: 5,
    position: 'absolute',
    right: 30,
  },
});

function compactText(value: string, maximumLength: number) {
  const normalized = value.replace(/\s+/g, ' ').trim();

  if (normalized.length <= maximumLength) {
    return normalized;
  }

  const shortened = normalized.slice(0, maximumLength - 3);
  const lastSpace = shortened.lastIndexOf(' ');

  return `${shortened.slice(0, Math.max(lastSpace, 0))}...`;
}

function MoistureChart({ report }: { report: InspectionReport }) {
  const width = 210;
  const height = 72;
  const padding = 10;
  const values = report.moistureTrend.map(({ value }) => value);
  const minimum = Math.min(...values) - 1;
  const maximum = Math.max(...values) + 1;
  const range = Math.max(maximum - minimum, 1);
  const denominator = Math.max(report.moistureTrend.length - 1, 1);
  const points = report.moistureTrend
    .map(({ value }, index) => {
      const x = padding + (index / denominator) * (width - padding * 2);
      const y =
        height - padding - ((value - minimum) / range) * (height - padding * 2);

      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <View style={[styles.panel, styles.chartFrame]}>
      <View style={styles.chartHeader}>
        <Text style={styles.sectionTitle}>Soil moisture</Text>
        <Text style={styles.metric}>{values.at(-1)}%</Text>
      </View>
      <Svg height={height} viewBox={`0 0 ${width} ${height}`} width="100%">
        <Line
          stroke="#d7dfda"
          strokeWidth={1}
          x1={padding}
          x2={width - padding}
          y1={height - padding}
          y2={height - padding}
        />
        <Polyline
          fill="none"
          points={points}
          stroke="#315b3e"
          strokeWidth={2}
        />
      </Svg>
      <View style={styles.chartDates}>
        <Text>{report.moistureTrend.at(0)?.label}</Text>
        <Text>{report.moistureTrend.at(-1)?.label}</Text>
      </View>
    </View>
  );
}

function MetadataItem({
  isLast = false,
  label,
  value,
}: {
  isLast?: boolean;
  label: string;
  value: string;
}) {
  return (
    <View
      style={
        isLast
          ? [styles.metadataItem, styles.metadataItemLast]
          : styles.metadataItem
      }
    >
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function EvidenceList({ report }: { report: InspectionReport }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>Evidence reviewed</Text>
      {report.evidence.map((item, index) => (
        <View key={`${item.source}-${index}`} style={styles.evidence}>
          <View style={styles.evidenceHeader}>
            <Text style={styles.evidenceSource}>
              {item.source.replace('-', ' ')}
            </Text>
            <Text style={styles.evidenceMeta}>
              {item.quality.replace('-', ' ')}
              {item.observedAt ? ` · ${item.observedAt.slice(0, 10)}` : ''}
            </Text>
          </View>
          <Text style={styles.body}>{compactText(item.statement, 150)}</Text>
        </View>
      ))}
    </View>
  );
}

function ActionPlan({ report }: { report: InspectionReport }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>Action plan</Text>
      <View style={styles.planStep}>
        <Text style={styles.stepNumber}>1</Text>
        <View style={styles.stepContent}>
          <Text style={styles.stepLabel}>Action</Text>
          <Text style={styles.body}>{compactText(report.action, 120)}</Text>
        </View>
      </View>
      <View style={styles.planStep}>
        <Text style={styles.stepNumber}>2</Text>
        <View style={styles.stepContent}>
          <Text style={styles.stepLabel}>Follow-up</Text>
          <Text style={styles.body}>
            {compactText(report.nextFollowUp, 120)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function InspectionReportDocument({
  logoDataUrl,
  report,
}: {
  logoDataUrl: string;
  report: InspectionReport;
}) {
  return (
    <Document
      author="Vinea"
      creationDate={new Date(report.generatedAt)}
      subject="Technician-reviewed vineyard inspection"
      title={`Inspection report · ${report.parcelName}`}
    >
      <Page size={DIN_A4_SIZE} style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brand}>
            {/* react-pdf Image is not a DOM image and has no alt prop. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={logoDataUrl} style={styles.logo} />
            <View>
              <Text style={styles.title}>Vinea inspection report</Text>
              <Text style={styles.subtitle}>{report.anomaly}</Text>
            </View>
          </View>
          <Text style={styles.badge}>Technician-reviewed inspection report</Text>
        </View>

        <View style={styles.metadata}>
          <MetadataItem label="Parcel" value={report.parcelName} />
          <MetadataItem label="Sector" value={report.sectorName} />
          <MetadataItem label="Inspection date" value={report.inspectionDate} />
          <MetadataItem
            isLast
            label="Technician"
            value={report.technicianName}
          />
        </View>

        <View style={styles.finding}>
          <Text style={styles.findingLabel}>Finding</Text>
          <Text style={styles.findingTitle}>{report.anomaly}</Text>
          <Text style={styles.findingSummary}>
            {compactText(report.summary, 280)}
          </Text>
        </View>

        <View style={styles.columns}>
          <View style={styles.mainColumn}>
            <EvidenceList report={report} />
          </View>

          <View style={styles.sideColumn}>
            <MoistureChart report={report} />
            {report.photoDataUrl ? (
              <View style={styles.panel}>
                <Text style={styles.sectionTitle}>Field photograph</Text>
                {/* react-pdf Image is not a DOM image and has no alt prop. */}
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image
                  src={report.photoDataUrl}
                  style={styles.photo}
                />
              </View>
            ) : null}
            <ActionPlan report={report} />
          </View>
        </View>

        <View style={styles.assessment}>
          <View style={styles.assessmentColumn}>
            <Text style={styles.sectionTitle}>Assessment</Text>
            <Text style={styles.body}>
              {compactText(report.interpretation, 220)}
            </Text>
          </View>
          <View
            style={[styles.assessmentColumn, styles.assessmentDivider]}
          >
            <Text style={styles.sectionTitle}>Limits</Text>
            <Text style={styles.body}>
              {compactText(report.uncertainty, 170)}
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>
          This report supports technician review and is not an official agronomic diagnosis. Simulated evidence is labelled above.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderInspectionReportPdf(report: InspectionReport) {
  const logo = await readFile(
    path.join(process.cwd(), 'public', 'vinea-avatar.png'),
  );
  const logoDataUrl = `data:image/png;base64,${logo.toString('base64')}`;

  return renderToBuffer(
    <InspectionReportDocument logoDataUrl={logoDataUrl} report={report} />,
  );
}
