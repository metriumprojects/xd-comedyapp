import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import COLORS from '@/src/theme/colors';

interface CustomInputProps extends TextInputProps {
	label?: string;
	error?: string;
	isPassword?: boolean;
	leftIcon?: keyof typeof Ionicons.glyphMap;
}

export default function CustomInput({
	label,
	error,
	isPassword = false,
	leftIcon,
	style,
	...props
}: CustomInputProps) {
	const [showPassword, setShowPassword] = useState(false);

	return (
		<View style={styles.container}>
			{label && <Text style={styles.label}>{label}</Text>}
			<View style={[styles.inputContainer, error && styles.inputError]}>
				{leftIcon && (
					<Ionicons name={leftIcon} size={20} color={COLORS.textMuted} style={styles.leftIcon} />
				)}
				<TextInput
					style={[styles.input, leftIcon && styles.inputWithIcon, style]}
					placeholderTextColor={COLORS.textMuted}
					secureTextEntry={isPassword && !showPassword}
					{...props}
				/>
				{isPassword && (
					<TouchableOpacity
						onPress={() => setShowPassword(!showPassword)}
						style={styles.eyeIcon}
					>
						<Ionicons
							name={showPassword ? 'eye-outline' : 'eye-off-outline'}
							size={20}
							color={COLORS.textMuted}
						/>
					</TouchableOpacity>
				)}
			</View>
			{error && <Text style={styles.errorText}>{error}</Text>}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		marginBottom: 16,
	},
	label: {
		fontSize: 14,
		fontWeight: '600',
		color: COLORS.black,
	},
	inputContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderColor: COLORS.border,
		borderRadius: 8,
		paddingHorizontal: 12,
		backgroundColor: COLORS.surface,
	},
	input: {
		flex: 1,
		height: 48,
		fontSize: 16,
		color: COLORS.textPrimary,
	},
	inputWithIcon: {
		marginLeft: 8,
	},
	leftIcon: {
		marginRight: 8,
	},
	eyeIcon: {
		marginLeft: 8,
	},
	inputError: {
		borderColor: '#e74c3c',
	},
	errorText: {
		color: '#e74c3c',
		fontSize: 12,
		marginTop: 4,
	},
});
