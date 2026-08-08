import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import COLORS from '@/src/theme/colors';

interface VisibilitySettingsScreenProps {
  currentVisibility: 'public' | 'private' | 'specific';
  onConfirm: (v: 'public' | 'private' | 'specific') => void;
  groups: any[];
  tempSelectedGroups: string[];
  onToggleGroup: (group: any) => void;
  loadingGroups: boolean;
  onGoBack: () => void;
  Header: any;
}

export const VisibilitySettingsScreen: React.FC<VisibilitySettingsScreenProps> = ({
  currentVisibility,
  onConfirm,
  groups,
  tempSelectedGroups,
  onToggleGroup,
  loadingGroups,
  onGoBack,
  Header,
}) => {
  const options: { key: 'public' | 'private'; label: string; sub: string }[] = [
    { key: 'public', label: 'Public', sub: 'Anyone can see this collection' },
    { key: 'private', label: 'Private', sub: 'Only you can see this collection' },
  ];

  return (
    <>
      <Header title="Visibility" onLeft={onGoBack} />
      <ScrollView style={{ flex: 1 }}>
        {options.map(opt => (
          <View key={opt.key}>
            <TouchableOpacity
              style={styles.visRow}
              onPress={() => onConfirm(opt.key)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.visLabel}>{opt.label}</Text>
                <Text style={styles.visSub}>{opt.sub}</Text>
              </View>
              {currentVisibility === opt.key && (
                <Ionicons name="checkmark" size={20} color={COLORS.primary} />
              )}
            </TouchableOpacity>
            <View style={styles.divider} />
          </View>
        ))}

        <TouchableOpacity
          style={styles.visRow}
          onPress={() => onConfirm('specific')}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.visLabel}>Specific Groups</Text>
            <Text style={styles.visSub}>Only members of selected groups can see</Text>
          </View>
          {currentVisibility === 'specific' && (
            <Ionicons name="checkmark" size={20} color={COLORS.primary} />
          )}
        </TouchableOpacity>

        {currentVisibility === 'specific' && (
          <View style={styles.groupsContainer}>
            <Text style={styles.groupsLabel}>Select Groups</Text>
            {loadingGroups ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
            ) : groups.length === 0 ? (
              <Text style={styles.noGroupsText}>No groups found</Text>
            ) : (
              groups.map(g => {
                const isSelected = tempSelectedGroups.some(sid => String(sid) === String(g._id));
                return (
                  <TouchableOpacity
                    key={g._id}
                    style={styles.groupItem}
                    onPress={() => onToggleGroup(g)}
                  >
                    <Text style={styles.groupName}>{g.name}</Text>
                    <Ionicons
                      name={isSelected ? "checkbox" : "square-outline"}
                      size={20}
                      color={isSelected ? COLORS.primary : COLORS.textMuted}
                    />
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  visRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 },
  visLabel: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  visSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: COLORS.border, marginLeft: 16 },
  groupsContainer: { backgroundColor: COLORS.surface, paddingHorizontal: 16, paddingVertical: 12 },
  groupsLabel: { fontSize: 13, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase', marginBottom: 12 },
  noGroupsText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginVertical: 12 },
  groupItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  groupName: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '500' },
});
