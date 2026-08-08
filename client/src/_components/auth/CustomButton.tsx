import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TextStyle, TouchableOpacity, ViewStyle, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '@/src/theme/colors';

interface CustomButtonProps {
	title: string;
	onPress: () => void;
	variant?: 'primary' | 'secondary' | 'outline';
	loading?: boolean;
	disabled?: boolean;
	style?: ViewStyle;
	textStyle?: TextStyle;
	testID?: string;
	icon?: keyof typeof Ionicons.glyphMap;
	iconColor?: string;
}

export default function CustomButton({
	title,
	onPress,
	variant = 'primary',
	loading = false,
	disabled = false,
	style,
	textStyle,
	testID,
	icon,
	iconColor,
}: CustomButtonProps) {
	const getButtonStyle = () => {
		switch (variant) {
			case 'primary':
				return styles.primaryButton;
			case 'secondary':
				return styles.secondaryButton;
			case 'outline':
				return styles.outlineButton;
			default:
				return styles.primaryButton;
		}
	};

	const getTextStyle = () => {
		switch (variant) {
			case 'primary':
				return styles.primaryText;
			case 'secondary':
				return styles.secondaryText;
			case 'outline':
				return styles.outlineText;
			default:
				return styles.primaryText;
		}
	};

	const defaultIconColor = variant === 'outline' ? COLORS.textPrimary : (variant === 'secondary' ? COLORS.primary : COLORS.textLight);

	return (
		<TouchableOpacity
			testID={testID}
			style={[
				styles.button,
				getButtonStyle(),
				(disabled || loading) && styles.disabled,
				style,
			]}
			onPress={onPress}
			disabled={disabled || loading}
			activeOpacity={0.8}
		>
			{(variant === 'primary' || variant === 'secondary') && (
				<LinearGradient
					colors={COLORS.primaryGradient}
					start={{ x: 0, y: 0 }}
					end={{ x: 1, y: 0 }}
					style={[
						StyleSheet.absoluteFill,
						{ borderRadius: 8 },
						variant === 'secondary' && { padding: 1.5 }
					]}
				>
					{variant === 'secondary' && (
						<View style={{ flex: 1, backgroundColor: COLORS.card, borderRadius: 6.5 }} />
					)}
				</LinearGradient>
			)}

			{loading ? (
				<ActivityIndicator color={variant === 'primary' ? COLORS.textLight : (variant === 'secondary' ? COLORS.primary : COLORS.textPrimary)} />
			) : (
				<View style={styles.buttonContent}>
					{icon && (
						<Ionicons 
							name={icon} 
							size={20} 
							color={iconColor || defaultIconColor} 
							style={styles.icon} 
						/>
					)}
					<Text style={[getTextStyle(), textStyle]}>{title}</Text>
				</View>
			)}
		</TouchableOpacity>
	);
}

const styles = StyleSheet.create({
	button: {
		height: 50,
		borderRadius: 8,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 20,
		// Ensure inner absolute fill components respect borders if needed, but not strictly required
	},
	buttonContent: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 1, // Ensure text and icon appear above the absolute LinearGradient
	},
	icon: {
		marginRight: 10,
	},
	primaryButton: {
		borderWidth: 0,
	},
	secondaryButton: {
		borderWidth: 0,
	},
	outlineButton: {
		backgroundColor: 'transparent',
		borderWidth: 1,
		borderColor: COLORS.border,
	},
	primaryText: {
		color: COLORS.textLight,
		fontSize: 16,
		fontWeight: '600',
	},
	secondaryText: {
		color: COLORS.primary,
		fontSize: 16,
		fontWeight: '600',
	},
	outlineText: {
		color: COLORS.black,
		fontSize: 16,
		fontWeight: '600',
	},
	disabled: {
		opacity: 0.6,
	},
});
