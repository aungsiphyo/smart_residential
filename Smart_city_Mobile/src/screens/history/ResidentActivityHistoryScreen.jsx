import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ScreenContainer from '../../components/ScreenContainer';
import Card from '../../components/Card';
import { useTheme } from '../../context/ThemeContext';
import { fetchVisitorHistory } from '../../api/visitors';
import { fetchMyHelperRequests } from '../../api/helpers';
import { fetchMyReports } from '../../api/reports';

function formatDate(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
}

export default function ResidentActivityHistoryScreen({ navigation }) {
  const { theme } = useTheme();
  const [tab, setTab] = useState('visitors');
  const [visitors, setVisitors] = useState([]);
  const [helpers, setHelpers] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [visitorResult, helperResult, reportResult] = await Promise.all([
        fetchVisitorHistory({ limit: 100 }),
        fetchMyHelperRequests(),
        fetchMyReports({ limit: 100 }),
      ]);
      setVisitors(visitorResult.data || []);
      setHelpers(Array.isArray(helperResult) ? helperResult : []);
      setReports(Array.isArray(reportResult) ? reportResult : []);
    } catch (err) {
      if (!err.sessionExpired) setError(err.message || 'Unable to load activity history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const data = tab === 'visitors' ? visitors : tab === 'helpers' ? helpers : reports;

  const renderVisitor = ({ item }) => (
    <Card>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: theme.primary + '18' }]}>
          <Ionicons name="person-outline" size={20} color={theme.primary} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: theme.text }]}>{item.fullname}</Text>
          <Text style={[styles.meta, { color: theme.subtext }]}>Purpose: {item.purpose || 'General'}</Text>
          <Text style={[styles.meta, { color: theme.subtext }]}>Badge: {item.badgeNumber || 'Pending'}</Text>
          <Text style={[styles.date, { color: theme.inactive }]}>{formatDate(item.createdAt || item.visitDate)}</Text>
        </View>
      </View>
    </Card>
  );

  const renderHelper = ({ item }) => (
    <Card>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: theme.primary + '18' }]}>
          <Ionicons name="people-outline" size={20} color={theme.primary} />
        </View>
        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]}>{item.type}</Text>
            <Text style={[styles.status, { color: theme.primary }]}>{item.status}</Text>
          </View>
          <Text style={[styles.meta, { color: theme.subtext }]}>Preference: {item.gender_preferred || 'No Preference'}</Text>
          {item.helper_id?.fullname ? (
            <Text style={[styles.meta, { color: theme.subtext }]}>Helper: {item.helper_id.fullname}</Text>
          ) : null}
          {item.note ? <Text style={[styles.note, { color: theme.text }]}>{item.note}</Text> : null}
          <Text style={[styles.date, { color: theme.inactive }]}>{formatDate(item.created_at)}</Text>
        </View>
      </View>
    </Card>
  );

  const renderReport = ({ item }) => (
    <Card>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: theme.primary + '18' }]}>
          <Ionicons name="document-text-outline" size={20} color={theme.primary} />
        </View>
        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>
            <Text style={[styles.status, { color: theme.primary }]}>{item.status}</Text>
          </View>
          <Text style={[styles.meta, { color: theme.subtext }]}>{item.type} · {item.location}</Text>
          <Text style={[styles.note, { color: theme.text }]}>{item.message}</Text>
          {item.submitted_at ? (
            <Text style={[styles.meta, { color: theme.success }]}>Acknowledged by administration</Text>
          ) : null}
          <Text style={[styles.date, { color: theme.inactive }]}>{formatDate(item.created_at)}</Text>
        </View>
      </View>
    </Card>
  );

  return (
    <ScreenContainer navigation={navigation} topBarVariant="stack" title="My Activity History" showBottomNav>
      <FlatList
        data={data}
        keyExtractor={item => item._id}
        renderItem={tab === 'visitors' ? renderVisitor : tab === 'helpers' ? renderHelper : renderReport}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.primary} />}
        ListHeaderComponent={
          <>
            <View style={[styles.tabs, { backgroundColor: theme.card }]}>
              {[
                ['visitors', 'Visitors', 'person-outline'],
                ['helpers', 'Helpers', 'people-outline'],
                ['reports', 'Reports', 'document-text-outline'],
              ].map(([value, label, icon]) => {
                const active = tab === value;
                return (
                  <TouchableOpacity
                    key={value}
                    style={[styles.tab, active && { backgroundColor: theme.primary }]}
                    onPress={() => setTab(value)}>
                    <Ionicons name={icon} size={17} color={active ? theme.primaryText : theme.subtext} />
                    <Text style={[styles.tabText, { color: active ? theme.primaryText : theme.subtext }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.empty} size="large" color={theme.primary} />
          ) : (
            <Text style={[styles.empty, { color: theme.subtext }]}>No {tab} history yet</Text>
          )
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 36, flexGrow: 1 },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: 12, marginBottom: 16 },
  tab: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, paddingVertical: 10, borderRadius: 9 },
  tabText: { fontSize: 13, fontWeight: '800' },
  row: { flexDirection: 'row' },
  icon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  copy: { flex: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '800', marginBottom: 5 },
  status: { fontSize: 11, fontWeight: '800' },
  meta: { fontSize: 13, lineHeight: 19 },
  note: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  date: { fontSize: 11, marginTop: 7 },
  error: { textAlign: 'center', marginBottom: 12 },
  empty: { textAlign: 'center', paddingVertical: 48 },
});
