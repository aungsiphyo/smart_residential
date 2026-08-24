import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Card from '../../components/Card';
import ScreenContainer from '../../components/ScreenContainer';
import { fetchParkingStatus } from '../../api/parking';
import { subscribeToParkingUpdates } from '../../services/parkingSocket';
import { useTheme } from '../../context/ThemeContext';

const PARKING_TYPES = [
  {
    type: 'resident',
    title: 'Resident Parking',
    subtitle: 'Parking spaces reserved for Prime City residents',
    icon: 'car-sport-outline',
  },
  {
    type: 'visitor',
    title: 'Visitor Parking',
    subtitle: 'Short-term parking spaces for registered visitors',
    icon: 'people-outline',
  },
];

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatUpdatedAt(value) {
  if (!value) return 'Waiting for an update';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Update time unavailable'
    : date.toLocaleString();
}

function ParkingCard({ definition, parking, theme }) {
  if (!parking) {
    return (
      <Card>
        <View style={styles.unavailableRow}>
          <Ionicons
            name={definition.icon}
            size={26}
            color={theme.inactive}
          />
          <View style={styles.flex}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              {definition.title}
            </Text>
            <Text style={[styles.cardSubtitle, { color: theme.subtext }]}>
              Parking data is not configured yet.
            </Text>
          </View>
        </View>
      </Card>
    );
  }

  const total = number(parking.totalSlot);
  const used = number(parking.usedSlot);
  const maintenance = number(parking.maintenanceSlot);
  const available = number(parking.availableSlot);
  const usable = Math.max(total - maintenance, 0);
  const occupancy = usable > 0 ? Math.min(used / usable, 1) : 0;
  const isFull = available <= 0;
  const statusColor = isFull ? theme.danger : theme.success;
  const statusBackground = isFull ? theme.dangerBg : theme.successBg;

  return (
    <Card>
      <View style={styles.cardHeader}>
        <View
          style={[styles.cardIcon, { backgroundColor: theme.primary + '1F' }]}
        >
          <Ionicons name={definition.icon} size={25} color={theme.primary} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            {definition.title}
          </Text>
          <Text style={[styles.cardSubtitle, { color: theme.subtext }]}>
            {definition.subtitle}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusBackground }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {isFull ? 'Full' : 'Available'}
          </Text>
        </View>
      </View>

      <View style={[styles.availabilityBox, { backgroundColor: theme.input }]}>
        <Text style={[styles.availableNumber, { color: statusColor }]}>
          {available}
        </Text>
        <View style={styles.flex}>
          <Text style={[styles.availableLabel, { color: theme.text }]}>
            slots available
          </Text>
          <Text style={[styles.availableMeta, { color: theme.subtext }]}>
            {used} occupied out of {usable} usable spaces
          </Text>
        </View>
      </View>

      <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: isFull ? theme.danger : theme.primary,
              width: `${Math.round(occupancy * 100)}%`,
            },
          ]}
        />
      </View>

      <View style={styles.statsRow}>
        {[
          ['Total', total],
          ['Occupied', used],
          ['Maintenance', maintenance],
        ].map(([label, value]) => (
          <View key={label} style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {value}
            </Text>
            <Text style={[styles.statLabel, { color: theme.subtext }]}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.updatedRow, { borderTopColor: theme.border }]}>
        <Ionicons name="time-outline" size={14} color={theme.inactive} />
        <Text style={[styles.updatedText, { color: theme.inactive }]}>
          Updated {formatUpdatedAt(parking.updatedAt || parking.updated_at)}
        </Text>
      </View>
    </Card>
  );
}

export default function ParkingScreen({ navigation }) {
  const { theme } = useTheme();
  const [parkingItems, setParkingItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [error, setError] = useState('');

  const parkingByType = useMemo(
    () =>
      Object.fromEntries(
        parkingItems.map(item => [String(item.type).toLowerCase(), item]),
      ),
    [parkingItems],
  );

  const loadParking = useCallback(async (mode = 'initial') => {
    if (mode === 'refresh') setRefreshing(true);
    else if (mode === 'initial') setLoading(true);
    if (mode !== 'silent') setError('');
    try {
      setParkingItems(await fetchParkingStatus());
    } catch (err) {
      if (!err.sessionExpired && mode !== 'silent') {
        setError(err.message || 'Unable to load parking availability');
      }
    } finally {
      setLoading(false);
      if (mode === 'refresh') setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadParking();
      const timer = setInterval(() => loadParking('silent'), 30_000);
      return () => clearInterval(timer);
    }, [loadParking]),
  );

  useEffect(
    () =>
      subscribeToParkingUpdates(
        updated => {
          if (!updated?.type) return;
          setParkingItems(current => {
            const withoutUpdated = current.filter(
              item => item.type !== updated.type,
            );
            return [...withoutUpdated, updated];
          });
        },
        setRealtimeConnected,
      ),
    [],
  );

  return (
    <ScreenContainer
      navigation={navigation}
      topBarVariant="stack"
      title="Parking Slots"
      showBottomNav
    >
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadParking('refresh')}
            tintColor={theme.primary}
          />
        }
      >
        <View style={styles.headingRow}>
          <View style={styles.flex}>
            <Text style={[styles.heading, { color: theme.text }]}>
              Live parking availability
            </Text>
            <Text style={[styles.headingSubtitle, { color: theme.subtext }]}>
              Resident and visitor slots update from the Prime City parking
              system.
            </Text>
          </View>
          <View
            style={[
              styles.liveBadge,
              {
                backgroundColor: realtimeConnected
                  ? theme.successBg
                  : theme.input,
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: realtimeConnected
                    ? theme.success
                    : theme.inactive,
                },
              ]}
            />
            <Text
              style={[
                styles.liveText,
                {
                  color: realtimeConnected ? theme.success : theme.subtext,
                },
              ]}
            >
              {realtimeConnected ? 'Live' : 'Refreshing'}
            </Text>
          </View>
        </View>

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: theme.dangerBg }]}>
            <Ionicons name="alert-circle-outline" size={20} color={theme.danger} />
            <View style={styles.flex}>
              <Text style={[styles.errorText, { color: theme.danger }]}>
                {error}
              </Text>
              <TouchableOpacity onPress={() => loadParking()}>
                <Text style={[styles.retryText, { color: theme.primary }]}>
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {loading && !parkingItems.length ? (
          <ActivityIndicator
            style={styles.loader}
            size="large"
            color={theme.primary}
          />
        ) : (
          PARKING_TYPES.map(definition => (
            <ParkingCard
              key={definition.type}
              definition={definition}
              parking={parkingByType[definition.type]}
              theme={theme}
            />
          ))
        )}

        <View style={[styles.infoBox, { backgroundColor: theme.primaryBg }]}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={theme.primary}
          />
          <Text style={[styles.infoText, { color: theme.text }]}>
            Availability can change as vehicles enter or leave. Pull down to
            refresh if your connection is temporarily offline.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40, gap: 13 },
  flex: { flex: 1 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  heading: { fontSize: 23, fontWeight: '900', marginBottom: 5 },
  headingSubtitle: { fontSize: 13, lineHeight: 19 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  liveText: { fontSize: 11, fontWeight: '800' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '900', marginBottom: 3 },
  cardSubtitle: { fontSize: 12, lineHeight: 17 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 6 },
  statusText: { fontSize: 10, fontWeight: '900' },
  availabilityBox: { flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 13, padding: 14, marginTop: 16 },
  availableNumber: { fontSize: 40, lineHeight: 44, fontWeight: '900' },
  availableLabel: { fontSize: 15, fontWeight: '800' },
  availableMeta: { fontSize: 11, marginTop: 3 },
  progressTrack: { height: 7, borderRadius: 4, marginTop: 14, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  statsRow: { flexDirection: 'row', marginTop: 15 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 17, fontWeight: '900' },
  statLabel: { fontSize: 10, marginTop: 3 },
  updatedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, borderTopWidth: 1, paddingTop: 11, marginTop: 13 },
  updatedText: { fontSize: 10 },
  unavailableRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 70 },
  errorBox: { flexDirection: 'row', gap: 9, borderRadius: 12, padding: 12 },
  errorText: { fontSize: 12, lineHeight: 17 },
  retryText: { fontSize: 12, fontWeight: '900', marginTop: 5 },
  loader: { paddingVertical: 70 },
  infoBox: { flexDirection: 'row', gap: 9, borderRadius: 12, padding: 12 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18 },
});
