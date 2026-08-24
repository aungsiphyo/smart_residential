import React, { useCallback, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Image,
} from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { showPrimeAlert } from '../../services/primeAlert';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ScreenContainer from '../../components/ScreenContainer';
import Card from '../../components/Card';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import {
  fetchHelperRequests,
  fetchHelpers,
  fetchMyHelperRequests,
  submitHelperRequest,
} from '../../api/helpers';

function getExperienceText(value) {
  const years = Number(value || 0);
  if (!years) return 'New helper';
  if (years === 1) return '1 year experience';
  return `${years} years experience`;
}

export default function HelperListScreen({ navigation }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [helpers, setHelpers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [submittingId, setSubmittingId] = useState(null);
  const isAdmin = ['Admin', 'Staff'].includes(user?.role);

  const activeRequestCount = requests.filter(
    item => item.status !== 'Completed',
  ).length;

  const loadHelpers = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        let helperData = [];
        let requestData = [];

        if (isAdmin) {
          requestData = await fetchHelperRequests();
        } else {
          const results = await Promise.all([
            fetchHelpers({ status: 'Active' }),
            fetchMyHelperRequests(),
          ]);
          helperData = results[0];
          requestData = results[1];
        }

        setHelpers(Array.isArray(helperData) ? helperData : []);
        setRequests(Array.isArray(requestData) ? requestData : []);
      } catch (err) {
        if (err.sessionExpired) return;
        setError(err.message || 'Failed to load helpers');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAdmin],
  );

  useFocusEffect(
    useCallback(() => {
      loadHelpers();
    }, [loadHelpers]),
  );

  const confirmSubmitRequest = item => {
    if (item.submitted_at || submittingId) return;

    const residentName = item.requested_by?.fullname || 'this resident';
    showPrimeAlert(
      'Submit helper request',
      `Accept this request and notify ${residentName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            setSubmittingId(item._id);
            try {
              const updated = await submitHelperRequest(item._id);
              setRequests(current =>
                current.map(request =>
                  request._id === item._id ? updated : request,
                ),
              );
              showPrimeAlert(
                'Submitted',
                'The helper request was accepted and the resident was notified.',
              );
            } catch (err) {
              if (!err.sessionExpired) {
                showPrimeAlert(
                  'Unable to submit',
                  err.message || 'Please try again.',
                );
              }
            } finally {
              setSubmittingId(null);
            }
          },
        },
      ],
    );
  };

  const renderHelper = ({ item }) => (
    <Card>
      <View style={styles.helperRow}>
        {item.photo ? (
          <Image source={{ uri: item.photo }} style={styles.avatar} />
        ) : (
          <View
            style={[
              styles.avatarFallback,
              { backgroundColor: theme.primary + '18' },
            ]}
          >
            <Ionicons name="person-outline" size={24} color={theme.primary} />
          </View>
        )}
        <View style={styles.helperInfo}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.name, { color: theme.text }]}
              numberOfLines={1}
            >
              {item.fullname}
            </Text>
            <View
              style={[styles.statusBadge, { backgroundColor: theme.successBg }]}
            >
              <Text style={[styles.statusText, { color: theme.success }]}>
                {item.status || 'Active'}
              </Text>
            </View>
          </View>
          <Text style={[styles.meta, { color: theme.subtext }]}>
            {[item.gender, getExperienceText(item.experience)]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {item.phone ? (
            <View style={styles.phoneRow}>
              <Ionicons name="call-outline" size={13} color={theme.subtext} />
              <Text style={[styles.phone, { color: theme.subtext }]}>
                {item.phone}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <TouchableOpacity
        style={[styles.requestBtn, { backgroundColor: theme.primary }]}
        onPress={() => navigation.navigate('HelperRequest', { helper: item })}
        activeOpacity={0.85}
      >
        <Ionicons
          name="add-circle-outline"
          size={18}
          color={theme.primaryText}
        />
        <Text style={[styles.requestText, { color: theme.primaryText }]}>
          Request helper
        </Text>
      </TouchableOpacity>
    </Card>
  );

  const renderAdminRequest = ({ item }) => {
    const room = item.room_id;
    const resident = item.requested_by;
    const helper = item.helper_id;
    const completed = item.status === 'Completed';
    const submitted = Boolean(item.submitted_at);
    const isSubmitting = submittingId === item._id;
    const statusColor = completed ? theme.success : theme.warning;
    const statusBackground = completed ? theme.successBg : theme.warningBg;

    return (
      <Card>
        <View style={styles.requestHeader}>
          <View
            style={[
              styles.avatarFallback,
              { backgroundColor: theme.primary + '18' },
            ]}
          >
            <Ionicons name="people-outline" size={24} color={theme.primary} />
          </View>
          <View style={styles.helperInfo}>
            <Text style={[styles.name, { color: theme.text }]}>
              {item.type}
            </Text>
            <Text style={[styles.meta, { color: theme.subtext }]}>
              Room {room?.room_name || 'Unknown'} ·{' '}
              {resident?.fullname || 'Unknown resident'}
            </Text>
          </View>
          <View
            style={[styles.statusBadge, { backgroundColor: statusBackground }]}
          >
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status}
            </Text>
          </View>
        </View>
        <View style={styles.requestDetails}>
          <Text style={[styles.requestDetail, { color: theme.subtext }]}>
            Preferred: {item.gender_preferred}
          </Text>
          {helper?.fullname ? (
            <Text style={[styles.requestDetail, { color: theme.subtext }]}>
              Helper: {helper.fullname}
            </Text>
          ) : null}
          {resident?.phone ? (
            <Text style={[styles.requestDetail, { color: theme.subtext }]}>
              Resident phone: {resident.phone}
            </Text>
          ) : null}
          {item.quoted_price_mmk != null ? (
            <Text style={[styles.requestDetail, { color: theme.primary }]}>
              Price: {Number(item.quoted_price_mmk).toLocaleString('en-US')} MMK
              {item.service_window ? ` · ${item.service_window}` : ''}
            </Text>
          ) : (
            <Text style={[styles.requestDetail, { color: theme.subtext }]}>
              Price: Admin confirmation required
            </Text>
          )}
          {item.note ? (
            <Text style={[styles.requestNote, { color: theme.text }]}>
              {item.note}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={[
            styles.submitBtn,
            {
              backgroundColor: submitted ? theme.successBg : theme.primary,
              borderColor: submitted ? theme.success : theme.primary,
            },
          ]}
          onPress={() => confirmSubmitRequest(item)}
          disabled={submitted || isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={theme.primaryText} />
          ) : (
            <Ionicons
              name={submitted ? 'checkmark-circle' : 'send-outline'}
              size={18}
              color={submitted ? theme.success : theme.primaryText}
            />
          )}
          <Text
            style={[
              styles.submitText,
              { color: submitted ? theme.success : theme.primaryText },
            ]}
          >
            {submitted ? 'Submitted' : 'Submit & notify resident'}
          </Text>
        </TouchableOpacity>
      </Card>
    );
  };

  return (
    <ScreenContainer
      navigation={navigation}
      topBarVariant="stack"
      title="Helpers"
      showBottomNav
    >
      <FlatList
        data={isAdmin ? requests : helpers}
        keyExtractor={item => item._id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadHelpers(true)}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View>
                <Text style={[styles.heading, { color: theme.text }]}>
                  {isAdmin ? 'Helper Requests' : 'Helpers'}
                </Text>
                <Text style={[styles.sub, { color: theme.subtext }]}>
                  {isAdmin
                    ? `${requests.length} resident request${
                        requests.length === 1 ? '' : 's'
                      }`
                    : activeRequestCount
                    ? `${activeRequestCount} active requests`
                    : 'Available house helpers'}
                </Text>
              </View>
            </View>

            {error ? (
              <View style={[styles.errorBanner, { borderColor: theme.danger }]}>
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color={theme.danger}
                />
                <Text style={[styles.errorText, { color: theme.text }]}>
                  {error}
                </Text>
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            <View style={styles.centered}>
              <Ionicons
                name="people-outline"
                size={36}
                color={theme.inactive}
              />
              <Text style={[styles.emptyText, { color: theme.subtext }]}>
                {isAdmin ? 'No helper requests found' : 'No helpers available'}
              </Text>
            </View>
          )
        }
        renderItem={isAdmin ? renderAdminRequest : renderHelper}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  sub: { fontSize: 14 },
  helperRow: { flexDirection: 'row', marginBottom: 14 },
  avatar: { width: 58, height: 58, borderRadius: 14, marginRight: 12 },
  avatarFallback: {
    width: 58,
    height: 58,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  helperInfo: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  name: { flex: 1, fontSize: 16, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
  meta: { fontSize: 13, marginBottom: 6 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  phone: { fontSize: 13 },
  requestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 11,
  },
  requestText: { fontSize: 14, fontWeight: '700' },
  requestHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  requestDetails: { marginTop: 10, gap: 4 },
  requestDetail: { fontSize: 13 },
  requestNote: { fontSize: 14, lineHeight: 20, marginTop: 5 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 11,
    marginTop: 14,
  },
  submitText: { fontSize: 14, fontWeight: '700' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { flex: 1, fontSize: 13 },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: { fontSize: 15, textAlign: 'center' },
});
